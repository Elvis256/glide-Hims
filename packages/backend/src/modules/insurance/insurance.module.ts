import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsuranceService } from './insurance.service';
import { InsuranceController } from './insurance.controller';
import { InsuranceProvider } from '../../database/entities/insurance-provider.entity';
import { InsurancePolicy } from '../../database/entities/insurance-policy.entity';
import { InsuranceClaim } from '../../database/entities/insurance-claim.entity';
import { ClaimItem } from '../../database/entities/claim-item.entity';
import { PreAuthorization } from '../../database/entities/pre-authorization.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { Invoice } from '../../database/entities/invoice.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InsuranceProvider,
      InsurancePolicy,
      InsuranceClaim,
      ClaimItem,
      PreAuthorization,
      Encounter,
      Invoice,
    ]),
  ],
  controllers: [InsuranceController],
  providers: [InsuranceService],
  exports: [InsuranceService],
})
export class InsuranceModule {}
