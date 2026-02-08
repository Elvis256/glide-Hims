import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, LessThanOrEqual, MoreThanOrEqual, Or } from 'typeorm';
import { InsurancePriceList } from '../../database/entities/insurance-price-list.entity';
import { PricingRule, PricingRuleType, DiscountType } from '../../database/entities/pricing-rule.entity';
import { Service } from '../../database/entities/service-category.entity';
import { LabTest } from '../../database/entities/lab-test.entity';
import { PatientMembership } from '../../database/entities/membership.entity';
import { InsurancePolicy } from '../../database/entities/insurance-policy.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import {
  CreateInsurancePriceListDto,
  UpdateInsurancePriceListDto,
  BulkCreateInsurancePriceListDto,
  CreatePricingRuleDto,
  UpdatePricingRuleDto,
  ResolvePriceDto,
  PriceQueryDto,
  ResolvedPrice,
  AppliedDiscount,
  PriceComparisonItem,
} from './pricing-engine.dto';

@Injectable()
export class PricingEngineService {
  constructor(
    @InjectRepository(InsurancePriceList)
    private readonly insurancePriceListRepo: Repository<InsurancePriceList>,
    @InjectRepository(PricingRule)
    private readonly pricingRuleRepo: Repository<PricingRule>,
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    @InjectRepository(LabTest)
    private readonly labTestRepo: Repository<LabTest>,
    @InjectRepository(PatientMembership)
    private readonly membershipRepo: Repository<PatientMembership>,
    @InjectRepository(InsurancePolicy)
    private readonly insurancePolicyRepo: Repository<InsurancePolicy>,
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
  ) {}

  // ==================== MAIN PRICE RESOLUTION ====================

  /**
   * Main method to resolve the final price for a service/lab test
   * Takes into account: insurance price lists, membership discounts, loyalty, etc.
   */
  async resolvePrice(dto: ResolvePriceDto): Promise<ResolvedPrice> {
    const today = new Date();
    let basePrice = 0;
    let payerType = dto.payerType || 'cash';
    let insuranceProviderId = dto.insuranceProviderId;

    // Get base price from service or lab test
    if (dto.serviceId) {
      const service = await this.serviceRepo.findOne({ where: { id: dto.serviceId } });
      if (service) {
        basePrice = Number(service.basePrice) || 0;
      }
    } else if (dto.labTestId) {
      const labTest = await this.labTestRepo.findOne({ where: { id: dto.labTestId } });
      if (labTest) {
        basePrice = Number(labTest.price) || 0;
      }
    }

    // If encounter provided, get payer info from encounter
    if (dto.encounterId) {
      const encounter = await this.encounterRepo.findOne({
        where: { id: dto.encounterId },
        relations: ['insurancePolicy', 'insurancePolicy.provider'],
      });
      if (encounter) {
        payerType = encounter.payerType || 'cash';
        if (encounter.insurancePolicy?.providerId) {
          insuranceProviderId = encounter.insurancePolicy.providerId;
        }
      }
    }

    const appliedDiscounts: AppliedDiscount[] = [];
    let finalPrice = basePrice;
    let insuranceAdjustment = 0;
    let membershipDiscount = 0;
    let loyaltyDiscount = 0;
    let otherDiscounts = 0;

    // 1. Check for insurance-specific price list
    if (payerType === 'insurance' && insuranceProviderId) {
      const insurancePrice = await this.getInsurancePrice(
        dto.serviceId || null,
        dto.labTestId || null,
        insuranceProviderId,
      );
      if (insurancePrice) {
        insuranceAdjustment = basePrice - insurancePrice.agreedPrice;
        finalPrice = insurancePrice.agreedPrice;
        appliedDiscounts.push({
          ruleId: insurancePrice.id,
          ruleName: 'Insurance Agreed Price',
          ruleType: 'insurance',
          discountType: 'price_list',
          discountAmount: insuranceAdjustment,
          description: `Insurance negotiated rate`,
        });
      }
    }

    // 2. Check for membership discount
    if (dto.patientId) {
      const membership = await this.getActiveMembership(dto.patientId);
      if (membership && membership.scheme?.discountPercent > 0) {
        const discountPercent = membership.scheme.discountPercent;
        const discountAmount = (finalPrice * discountPercent) / 100;
        
        // Check if membership discount can stack with insurance
        const canStack = await this.canDiscountStack('membership', appliedDiscounts);
        if (canStack || appliedDiscounts.length === 0) {
          membershipDiscount = discountAmount;
          finalPrice -= discountAmount;
          appliedDiscounts.push({
            ruleId: membership.id,
            ruleName: `${membership.scheme.name} Membership`,
            ruleType: 'membership',
            discountType: 'percentage',
            discountAmount: membershipDiscount,
            description: `${discountPercent}% membership discount`,
          });
        }
      }
    }

    // 3. Apply any active pricing rules
    const rules = await this.getActivePricingRules(dto.serviceId ? 'services' : 'lab');
    for (const rule of rules) {
      if (rule.ruleType === PricingRuleType.INSURANCE || rule.ruleType === PricingRuleType.MEMBERSHIP) {
        continue; // Already handled above
      }

      const canStack = await this.canDiscountStack(rule.ruleType, appliedDiscounts);
      if (!canStack && appliedDiscounts.length > 0 && !rule.canStack) {
        continue;
      }

      let discountAmount = 0;
      if (rule.discountType === DiscountType.PERCENTAGE && rule.discountValue) {
        discountAmount = (finalPrice * rule.discountValue) / 100;
      } else if (rule.discountType === DiscountType.FIXED_AMOUNT && rule.discountValue) {
        discountAmount = rule.discountValue;
      }

      // Apply max discount cap if set
      if (rule.maxDiscount && discountAmount > rule.maxDiscount) {
        discountAmount = rule.maxDiscount;
      }

      // Apply min amount threshold
      if (rule.minAmount && finalPrice < rule.minAmount) {
        continue;
      }

      if (discountAmount > 0) {
        otherDiscounts += discountAmount;
        finalPrice -= discountAmount;
        appliedDiscounts.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: rule.ruleType,
          discountType: rule.discountType,
          discountAmount,
          description: rule.description || `${rule.name} discount`,
        });
      }
    }

    // Ensure final price doesn't go below 0
    finalPrice = Math.max(0, finalPrice);

    return {
      originalPrice: basePrice,
      finalPrice: Math.round(finalPrice * 100) / 100,
      currency: 'UGX',
      payerType,
      appliedDiscounts,
      breakdown: {
        basePrice,
        insuranceAdjustment,
        membershipDiscount,
        loyaltyDiscount,
        otherDiscounts,
        subtotal: finalPrice,
        tax: 0, // TODO: Add tax calculation if needed
        total: finalPrice,
      },
    };
  }

  /**
   * Get insurance-specific price for a service or lab test
   */
  async getInsurancePrice(
    serviceId: string | null,
    labTestId: string | null,
    insuranceProviderId: string,
  ): Promise<InsurancePriceList | null> {
    const today = new Date();
    
    const whereCondition: any = {
      insuranceProviderId,
      isActive: true,
    };

    if (serviceId) {
      whereCondition.serviceId = serviceId;
    } else if (labTestId) {
      whereCondition.labTestId = labTestId;
    } else {
      return null;
    }

    const priceList = await this.insurancePriceListRepo.findOne({
      where: whereCondition,
    });

    // Check if within effective date range
    if (priceList) {
      if (priceList.effectiveFrom && new Date(priceList.effectiveFrom) > today) {
        return null;
      }
      if (priceList.effectiveTo && new Date(priceList.effectiveTo) < today) {
        return null;
      }
    }

    return priceList;
  }

  /**
   * Get active membership for a patient
   */
  async getActiveMembership(patientId: string): Promise<PatientMembership | null> {
    const today = new Date();
    return this.membershipRepo.findOne({
      where: {
        patientId,
        status: 'active',
      },
      relations: ['scheme'],
    });
  }

  /**
   * Get active pricing rules
   */
  async getActivePricingRules(appliesTo: string): Promise<PricingRule[]> {
    const today = new Date();
    return this.pricingRuleRepo.find({
      where: {
        isActive: true,
        appliesTo: In([appliesTo, 'all']),
      },
      order: { priority: 'ASC' },
    });
  }

  /**
   * Check if a discount type can stack with existing discounts
   */
  async canDiscountStack(ruleType: string, existingDiscounts: AppliedDiscount[]): Promise<boolean> {
    if (existingDiscounts.length === 0) return true;

    // Get the pricing rule for this type to check stacking rules
    const rule = await this.pricingRuleRepo.findOne({
      where: { ruleType: ruleType as PricingRuleType, isActive: true },
    });

    if (!rule) return true;
    if (rule.canStack) return true;

    // Check if it can stack with existing discount types
    if (rule.stackWithTypes) {
      const allowedTypes = rule.stackWithTypes.split(',').map(t => t.trim());
      return existingDiscounts.every(d => allowedTypes.includes(d.ruleType));
    }

    return false;
  }

  // ==================== INSURANCE PRICE LIST CRUD ====================

  async createInsurancePriceList(dto: CreateInsurancePriceListDto, userId: string): Promise<InsurancePriceList> {
    const priceList = this.insurancePriceListRepo.create({
      ...dto,
      createdById: userId,
    });
    return this.insurancePriceListRepo.save(priceList);
  }

  async bulkCreateInsurancePriceLists(dto: BulkCreateInsurancePriceListDto, userId: string): Promise<InsurancePriceList[]> {
    const priceLists = dto.items.map(item => this.insurancePriceListRepo.create({
      insuranceProviderId: dto.insuranceProviderId,
      serviceId: item.serviceId,
      labTestId: item.labTestId,
      agreedPrice: item.agreedPrice,
      discountPercent: item.discountPercent || 0,
      effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
      createdById: userId,
    }));
    return this.insurancePriceListRepo.save(priceLists);
  }

  async updateInsurancePriceList(id: string, dto: UpdateInsurancePriceListDto): Promise<InsurancePriceList> {
    const priceList = await this.insurancePriceListRepo.findOne({ where: { id } });
    if (!priceList) {
      throw new NotFoundException('Insurance price list not found');
    }
    Object.assign(priceList, dto);
    return this.insurancePriceListRepo.save(priceList);
  }

  async deleteInsurancePriceList(id: string): Promise<void> {
    await this.insurancePriceListRepo.delete(id);
  }

  async getInsurancePriceLists(query: PriceQueryDto): Promise<{ data: InsurancePriceList[]; total: number }> {
    const qb = this.insurancePriceListRepo.createQueryBuilder('ipl')
      .leftJoinAndSelect('ipl.insuranceProvider', 'provider')
      .leftJoinAndSelect('ipl.service', 'service')
      .leftJoinAndSelect('ipl.labTest', 'labTest');

    if (query.insuranceProviderId) {
      qb.andWhere('ipl.insurance_provider_id = :providerId', { providerId: query.insuranceProviderId });
    }
    if (query.serviceId) {
      qb.andWhere('ipl.service_id = :serviceId', { serviceId: query.serviceId });
    }
    if (query.labTestId) {
      qb.andWhere('ipl.lab_test_id = :labTestId', { labTestId: query.labTestId });
    }
    if (query.search) {
      qb.andWhere('(service.name ILIKE :search OR labTest.name ILIKE :search)', { search: `%${query.search}%` });
    }

    const [data, total] = await qb
      .skip(((query.page || 1) - 1) * (query.limit || 50))
      .take(query.limit || 50)
      .getManyAndCount();

    return { data, total };
  }

  async getInsurancePriceListById(id: string): Promise<InsurancePriceList> {
    const priceList = await this.insurancePriceListRepo.findOne({
      where: { id },
      relations: ['insuranceProvider', 'service', 'labTest'],
    });
    if (!priceList) {
      throw new NotFoundException('Insurance price list not found');
    }
    return priceList;
  }

  /**
   * Compare prices across different insurance providers
   */
  async comparePrices(serviceId?: string, labTestId?: string): Promise<PriceComparisonItem[]> {
    const qb = this.insurancePriceListRepo.createQueryBuilder('ipl')
      .leftJoinAndSelect('ipl.insuranceProvider', 'provider')
      .where('ipl.is_active = true');

    if (serviceId) {
      qb.andWhere('ipl.service_id = :serviceId', { serviceId });
    }
    if (labTestId) {
      qb.andWhere('ipl.lab_test_id = :labTestId', { labTestId });
    }

    const priceLists = await qb.getMany();

    // Get base price for comparison
    let basePrice = 0;
    if (serviceId) {
      const service = await this.serviceRepo.findOne({ where: { id: serviceId } });
      basePrice = Number(service?.basePrice) || 0;
    } else if (labTestId) {
      const labTest = await this.labTestRepo.findOne({ where: { id: labTestId } });
      basePrice = Number(labTest?.price) || 0;
    }

    return priceLists.map(pl => ({
      providerId: pl.insuranceProviderId,
      providerName: pl.insuranceProvider?.name || 'Unknown',
      agreedPrice: Number(pl.agreedPrice),
      discountPercent: Number(pl.discountPercent),
      effectivePrice: Number(pl.agreedPrice),
      savings: basePrice - Number(pl.agreedPrice),
    }));
  }

  // ==================== PRICING RULES CRUD ====================

  async createPricingRule(dto: CreatePricingRuleDto, userId: string): Promise<PricingRule> {
    const rule = this.pricingRuleRepo.create({
      ...dto,
      createdById: userId,
    });
    return this.pricingRuleRepo.save(rule);
  }

  async updatePricingRule(id: string, dto: UpdatePricingRuleDto): Promise<PricingRule> {
    const rule = await this.pricingRuleRepo.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException('Pricing rule not found');
    }
    Object.assign(rule, dto);
    return this.pricingRuleRepo.save(rule);
  }

  async deletePricingRule(id: string): Promise<void> {
    await this.pricingRuleRepo.delete(id);
  }

  async getPricingRules(): Promise<PricingRule[]> {
    return this.pricingRuleRepo.find({
      order: { priority: 'ASC' },
    });
  }

  async getPricingRuleById(id: string): Promise<PricingRule> {
    const rule = await this.pricingRuleRepo.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException('Pricing rule not found');
    }
    return rule;
  }
}
