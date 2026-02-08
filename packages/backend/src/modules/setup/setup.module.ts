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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      Facility,
      User,
      Role,
      UserRole,
      SystemSetting,
    ]),
  ],
  controllers: [SetupController],
  providers: [SetupService],
  exports: [SetupService],
})
export class SetupModule {}
