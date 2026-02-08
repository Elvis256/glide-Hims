import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { EmployeeRequiredGuard } from './guards/employee-required.guard';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { PasswordPolicy, PasswordHistory } from '../../database/entities/password-policy.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';
import { Permission } from '../../database/entities/permission.entity';
import { UserPermission } from '../../database/entities/user-permission.entity';
import { Employee } from '../../database/entities/employee.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserRole, PasswordPolicy, PasswordHistory, RolePermission, Permission, UserPermission, Employee]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard, PermissionsGuard, RateLimitGuard, EmployeeRequiredGuard],
  exports: [AuthService, JwtStrategy, RolesGuard, PermissionsGuard, RateLimitGuard, EmployeeRequiredGuard],
})
export class AuthModule {}
