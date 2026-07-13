import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Theatre } from '../../database/entities/theatre.entity';
import { SurgeryCase } from '../../database/entities/surgery-case.entity';
import { SurgeryConsumable } from '../../database/entities/surgery-consumable.entity';
import { Item } from '../../database/entities/inventory.entity';
import { SurgeryService } from './surgery.service';
import { SurgeryController } from './surgery.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { BillingModule } from '../billing/billing.module';
import { SurgerySafetyChecklist } from '../../database/entities/surgery-safety-checklist.entity';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Theatre,
      SurgeryCase,
      SurgeryConsumable,
      Item,
      SurgerySafetyChecklist,
    ]),
    forwardRef(() => InventoryModule),
    forwardRef(() => BillingModule),
    SystemSettingsModule,
  ],
  controllers: [SurgeryController],
  providers: [SurgeryService],
  exports: [SurgeryService],
})
export class SurgeryModule {}
