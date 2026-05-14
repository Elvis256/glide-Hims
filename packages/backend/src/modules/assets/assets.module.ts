import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import {
  FixedAsset,
  AssetDepreciation,
  AssetMaintenance,
  AssetTransfer,
  AssetTransferApproval,
  AssetCategory,
  AssetDisposal,
  AssetAllocation,
  AssetLocationHistory,
} from '../../database/entities/fixed-asset.entity';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FixedAsset,
      AssetDepreciation,
      AssetMaintenance,
      AssetTransfer,
      AssetTransferApproval,
      AssetCategory,
      AssetDisposal,
      AssetAllocation,
      AssetLocationHistory,
    ]),
    forwardRef(() => FinanceModule),
  ],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
