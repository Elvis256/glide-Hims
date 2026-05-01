import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { PosComplianceController } from './pos-compliance.controller';
import { PosComplianceService } from './pos-compliance.service';
import { PosShiftGuardService } from './services/pos-shift-guard.service';
import {
  PosRegister,
  PosShift,
  PosPaymentSplit,
  WholesaleCustomer,
  PricingTier,
  Delivery,
} from '../../database/entities/pos.entity';
import {
  PosCashDrawerEvent,
  PosZReport,
} from '../../database/entities/pos-compliance.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PosRegister,
      PosShift,
      PosPaymentSplit,
      WholesaleCustomer,
      PricingTier,
      Delivery,
      PosCashDrawerEvent,
      PosZReport,
    ]),
  ],
  controllers: [PosController, PosComplianceController],
  providers: [PosService, PosComplianceService, PosShiftGuardService],
  exports: [PosService, PosComplianceService, PosShiftGuardService],
})
export class PosModule {}
