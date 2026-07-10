import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorFeeProfile } from '../../database/entities/doctor-fee-profile.entity';
import { Service as ServiceCatalog } from '../../database/entities/service-category.entity';
import { Department } from '../../database/entities/department.entity';
import { User } from '../../database/entities/user.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { DoctorFeesService } from './doctor-fees.service';
import { DoctorFeesController } from './doctor-fees.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DoctorFeeProfile, ServiceCatalog, Department, User, Encounter]),
  ],
  controllers: [DoctorFeesController],
  providers: [DoctorFeesService],
  exports: [DoctorFeesService],
})
export class DoctorFeesModule {}
