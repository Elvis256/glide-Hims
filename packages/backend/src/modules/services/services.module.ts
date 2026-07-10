import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import {
  ServiceCategory,
  Service,
  ServicePrice,
  ServicePackage,
} from '../../database/entities/service-category.entity';
import { ServiceConsumable } from '../../database/entities/service-consumable.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceCategory,
      Service,
      ServicePrice,
      ServicePackage,
      ServiceConsumable,
    ]),
  ],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
