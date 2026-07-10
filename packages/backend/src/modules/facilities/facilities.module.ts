import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Facility } from '../../database/entities/facility.entity';
import { Department } from '../../database/entities/department.entity';
import { Unit } from '../../database/entities/unit.entity';
import { User } from '../../database/entities/user.entity';
import { Employee } from '../../database/entities/employee.entity';
import { FacilitiesService } from './facilities.service';
import { FacilitiesController } from './facilities.controller';
import { LicensingModule } from '../licensing/licensing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Facility, Department, Unit, User, Employee]),
    forwardRef(() => LicensingModule),
  ],
  controllers: [FacilitiesController],
  providers: [FacilitiesService],
  exports: [FacilitiesService],
})
export class FacilitiesModule {}
