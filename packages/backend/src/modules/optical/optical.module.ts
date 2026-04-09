import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OpticalService } from './optical.service';
import { OpticalController } from './optical.controller';
import {
  EyeExam,
  OpticalPrescription,
  ContactLensPrescription,
  Frame,
  LensProduct,
  SpectacleOrder,
  VisualFieldTest,
} from '../../database/entities/optical.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EyeExam,
      OpticalPrescription,
      ContactLensPrescription,
      Frame,
      LensProduct,
      SpectacleOrder,
      VisualFieldTest,
    ]),
  ],
  controllers: [OpticalController],
  providers: [OpticalService],
  exports: [OpticalService],
})
export class OpticalModule {}
