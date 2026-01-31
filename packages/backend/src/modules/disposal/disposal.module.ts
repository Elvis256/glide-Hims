import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisposalController } from './disposal.controller';
import { DisposalService } from './disposal.service';
import { DisposalRecord } from '../../database/entities/disposal.entity';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DisposalRecord]),
    InventoryModule,
  ],
  controllers: [DisposalController],
  providers: [DisposalService],
  exports: [DisposalService],
})
export class DisposalModule {}
