import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { Role } from '../../database/entities/role.entity';
import { Employee } from '../../database/entities/employee.entity';
import { UserPermission } from '../../database/entities/user-permission.entity';
import { Permission } from '../../database/entities/permission.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserRole, Role, Employee, UserPermission, Permission])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
