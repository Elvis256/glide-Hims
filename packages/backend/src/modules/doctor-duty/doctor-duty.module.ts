import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorDuty } from '../../database/entities/doctor-duty.entity';
import { User } from '../../database/entities/user.entity';
import { DoctorDutyController } from './doctor-duty.controller';
import { DoctorDutyService } from './doctor-duty.service';

@Module({
  imports: [TypeOrmModule.forFeature([DoctorDuty, User])],
  controllers: [DoctorDutyController],
  providers: [DoctorDutyService],
  exports: [DoctorDutyService],
})
export class DoctorDutyModule {}
