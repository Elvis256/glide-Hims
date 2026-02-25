import { Module, OnModuleInit, Logger } from '@nestjs/common';
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
import { Role } from '../../database/entities/role.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserRole, PasswordPolicy, PasswordHistory, RolePermission, Permission, UserPermission, Employee, Role]),
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
export class AuthModule implements OnModuleInit {
  private readonly logger = new Logger('AuthModule');

  constructor(
    @InjectRepository(Permission) private permissionRepo: Repository<Permission>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(RolePermission) private rolePermRepo: Repository<RolePermission>,
  ) {}

  async onModuleInit() {
    // Auto-assign all permissions to Super Admin on startup
    try {
      const superAdmin = await this.roleRepo.findOne({ where: { name: 'Super Admin' } });
      if (!superAdmin) return;

      const allPerms = await this.permissionRepo.find();
      const existing = await this.rolePermRepo.find({ where: { roleId: superAdmin.id } });
      const existingPermIds = new Set(existing.map(rp => rp.permissionId));
      const missing = allPerms.filter(p => !existingPermIds.has(p.id));

      if (missing.length > 0) {
        await this.rolePermRepo.save(
          missing.map(p => this.rolePermRepo.create({ roleId: superAdmin.id, permissionId: p.id })),
        );
        this.logger.log(`Auto-assigned ${missing.length} permissions to Super Admin`);
      }
    } catch (e) {
      this.logger.warn('Permission sync skipped: ' + e.message);
    }
  }
}
