import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { Role } from '../../database/entities/role.entity';
import { Employee } from '../../database/entities/employee.entity';
import { Department } from '../../database/entities/department.entity';
import { UserPermission } from '../../database/entities/user-permission.entity';
import { Permission } from '../../database/entities/permission.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';
import { LicensingModule } from '../licensing/licensing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserRole,
      Role,
      Employee,
      Department,
      UserPermission,
      Permission,
      AuditLog,
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => LicensingModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
