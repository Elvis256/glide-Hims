import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PharmacyController } from './pharmacy.controller';
import { PharmacyService } from './pharmacy.service';
import { PharmacySale, PharmacySaleItem } from '../../database/entities/pharmacy-sale.entity';
import { Store } from '../../database/entities/store.entity';
import { Item, StockLedger, StockBalance } from '../../database/entities/inventory.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Prescription } from '../../database/entities/prescription.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PharmacySale, PharmacySaleItem, Store, Item, StockLedger, StockBalance, Patient, Prescription])],
  controllers: [PharmacyController],
  providers: [PharmacyService],
  exports: [PharmacyService],
})
export class PharmacyModule {}
