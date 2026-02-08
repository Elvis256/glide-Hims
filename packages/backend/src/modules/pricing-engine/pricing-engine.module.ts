import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsurancePriceList } from '../../database/entities/insurance-price-list.entity';
import { PricingRule } from '../../database/entities/pricing-rule.entity';
import { Service } from '../../database/entities/service-category.entity';
import { LabTest } from '../../database/entities/lab-test.entity';
import { PatientMembership } from '../../database/entities/membership.entity';
import { InsurancePolicy } from '../../database/entities/insurance-policy.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { PricingEngineService } from './pricing-engine.service';
import { PricingEngineController } from './pricing-engine.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InsurancePriceList,
      PricingRule,
      Service,
      LabTest,
      PatientMembership,
      InsurancePolicy,
      Encounter,
    ]),
  ],
  controllers: [PricingEngineController],
  providers: [PricingEngineService],
  exports: [PricingEngineService],
})
export class PricingEngineModule {}
