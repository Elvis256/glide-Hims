import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import {
  FixedAsset,
  AssetDepreciation,
  AssetMaintenance,
  AssetTransfer,
} from '../../database/entities/fixed-asset.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FixedAsset,
      AssetDepreciation,
      AssetMaintenance,
      AssetTransfer,
    ]),
  ],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
