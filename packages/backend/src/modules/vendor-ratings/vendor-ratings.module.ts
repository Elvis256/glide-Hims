import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorRatingsController } from './vendor-ratings.controller';
import { VendorRatingsService } from './vendor-ratings.service';
import { VendorRating, VendorRatingSummary } from '../../database/entities/vendor-rating.entity';
import { Supplier } from '../../database/entities/supplier.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VendorRating, VendorRatingSummary, Supplier])],
  controllers: [VendorRatingsController],
  providers: [VendorRatingsService],
  exports: [VendorRatingsService],
})
export class VendorRatingsModule {}
