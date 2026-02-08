import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BiometricsController } from './biometrics.controller';
import { BiometricsService } from './biometrics.service';
import { BiometricData } from '../../database/entities/biometric-data.entity';
import { User } from '../../database/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BiometricData, User])],
  controllers: [BiometricsController],
  providers: [BiometricsService],
  exports: [BiometricsService],
})
export class BiometricsModule {}
