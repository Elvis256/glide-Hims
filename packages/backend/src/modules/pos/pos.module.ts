import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import {
  PosRegister,
  PosShift,
  PosPaymentSplit,
  WholesaleCustomer,
  PricingTier,
  Delivery,
} from '../../database/entities/pos.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PosRegister,
      PosShift,
      PosPaymentSplit,
      WholesaleCustomer,
      PricingTier,
      Delivery,
    ]),
  ],
  controllers: [PosController],
  providers: [PosService],
  exports: [PosService],
})
export class PosModule {}
