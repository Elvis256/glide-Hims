import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SetupController } from './setup.controller';
import { SetupService } from './setup.service';
import { Tenant } from '../../database/entities/tenant.entity';
import { Facility } from '../../database/entities/facility.entity';
import { User } from '../../database/entities/user.entity';
import { Role } from '../../database/entities/role.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { SystemSetting } from '../../database/entities/system-setting.entity';
import { Department } from '../../database/entities/department.entity';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, Facility, User, Role, UserRole, SystemSetting, Department]),
    SystemSettingsModule,
  ],
  controllers: [SetupController],
  providers: [SetupService],
  exports: [SetupService],
})
export class SetupModule {}
