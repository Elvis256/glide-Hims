import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlag } from '../../database/entities/feature-flag.entity';
import { SystemFeature } from '../../database/entities/system-feature.entity';
import { FeatureGuard } from './guards/feature.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([FeatureFlag, SystemFeature])],
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService, FeatureGuard],
  exports: [FeatureFlagsService, FeatureGuard],
})
export class FeatureFlagsModule {}
