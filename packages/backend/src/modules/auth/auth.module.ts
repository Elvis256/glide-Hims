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
    try {
      const allPerms = await this.permissionRepo.find();
      const permByCode = new Map(allPerms.map(p => [p.code, p.id]));

      // Auto-assign all permissions to Super Admin
      const superAdmin = await this.roleRepo.findOne({ where: { name: 'Super Admin' } });
      if (superAdmin) {
        const existing = await this.rolePermRepo.find({ where: { roleId: superAdmin.id } });
        const existingPermIds = new Set(existing.map(rp => rp.permissionId));
        const missing = allPerms.filter(p => !existingPermIds.has(p.id));
        if (missing.length > 0) {
          await this.rolePermRepo.save(
            missing.map(p => this.rolePermRepo.create({ roleId: superAdmin.id, permissionId: p.id })),
          );
          this.logger.log(`Auto-assigned ${missing.length} permissions to Super Admin`);
        }
      }

      // Ensure essential role permissions are assigned
      const rolePerms: Record<string, string[]> = {
        'Doctor': ['vitals.update','vitals.read','vitals.create','diagnoses.update','nursing.read','queue.manage','reports.read','encounters.create','encounters.read','encounters.update','orders.create','orders.read','patients.read','patients.update','prescriptions.create','prescriptions.read','lab.read','lab.create','radiology.read','radiology.orders','clinical-notes.create','clinical-notes.read','clinical-notes.update'],
        'Nurse': ['vitals.update','vitals.read','vitals.create','diagnoses.update','clinical-notes.update','orders.create','reports.read','nursing.create','nursing.read','nursing.update','queue.read','queue.create','queue.update','queue.manage','patients.read','patients.update','encounters.read','encounters.update','triage.read','triage.update'],
        'Lab Technician': ['orders.create','orders.update','orders.read','lab.create','lab.read','lab.update','patients.read','reports.read','labqc.view'],
        'Pharmacist': ['attendance.create','attendance.read','leave.create','leave.read','facilities.read','pharmacy.read','pharmacy.create','pharmacy.update','pharmacy.dispense','pharmacy.inventory','pharmacy.reports','prescriptions.read','prescriptions.update','stores.read','patients.read','reports.read','billing.read','billing.create','billing.collect_payment'],
        'Radiologist': ['orders.create','facilities.read','radiology.read','radiology.create','radiology.update','radiology.view','radiology.results','radiology.orders','radiology.analytics','patients.read','reports.read'],
        'Receptionist': ['vitals.read','vitals.create','encounters.update','encounters.create','encounters.read','reports.read','analytics.read','patients.create','patients.read','patients.update','queue.create','queue.read','queue.update','queue.manage','queue.delete','triage.read','billing.read','services.read','appointments:create','appointments:read','appointments:update'],
        'Cashier': ['encounters.read','billing.read','billing.create','billing.update','billing.collect_payment','patients.read','reports.read','analytics.read','insurance.read','services.read'],
        'Store Keeper': ['stores.read','stores.create','stores.update','inventory.read','inventory.create','inventory.update','inventory.adjust','inventory.transfer','reports.read','suppliers.read','procurement.read'],
      };

      for (const [roleName, codes] of Object.entries(rolePerms)) {
        const role = await this.roleRepo.findOne({ where: { name: roleName } });
        if (!role) continue;
        const existing = await this.rolePermRepo.find({ where: { roleId: role.id } });
        const existingPermIds = new Set(existing.map(rp => rp.permissionId));
        const toAdd = codes
          .map(code => permByCode.get(code))
          .filter((id): id is string => !!id && !existingPermIds.has(id));
        if (toAdd.length > 0) {
          await this.rolePermRepo.save(
            toAdd.map(pid => this.rolePermRepo.create({ roleId: role.id, permissionId: pid })),
          );
          this.logger.log(`Auto-assigned ${toAdd.length} permissions to ${roleName}`);
        }
      }
    } catch (e) {
      this.logger.warn('Permission sync skipped: ' + e.message);
    }
  }
}
