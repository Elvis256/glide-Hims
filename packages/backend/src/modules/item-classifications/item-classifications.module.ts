import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ItemCategory,
  ItemSubcategory,
  ItemBrand,
  ItemTag,
  ItemUnit,
  ItemFormulation,
  StorageCondition,
  ItemTagAssignment,
} from '../../database/entities/item-classification.entity';
import { ItemClassificationsController } from './item-classifications.controller';
import { ItemClassificationsService } from './item-classifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ItemCategory,
      ItemSubcategory,
      ItemBrand,
      ItemTag,
      ItemUnit,
      ItemFormulation,
      StorageCondition,
      ItemTagAssignment,
    ]),
  ],
  controllers: [ItemClassificationsController],
  providers: [ItemClassificationsService],
  exports: [ItemClassificationsService],
})
export class ItemClassificationsModule {}
