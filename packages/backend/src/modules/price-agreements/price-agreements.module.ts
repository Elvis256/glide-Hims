import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceAgreementsController } from './price-agreements.controller';
import { PriceAgreementsService } from './price-agreements.service';
import { PriceAgreement } from '../../database/entities/price-agreement.entity';
import { Supplier } from '../../database/entities/supplier.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PriceAgreement, Supplier])],
  controllers: [PriceAgreementsController],
  providers: [PriceAgreementsService],
  exports: [PriceAgreementsService],
})
export class PriceAgreementsModule {}
