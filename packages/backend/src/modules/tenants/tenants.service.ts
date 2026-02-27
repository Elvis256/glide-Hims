import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Tenant } from '../../database/entities/tenant.entity';
import { Facility } from '../../database/entities/facility.entity';
import { User } from '../../database/entities/user.entity';
import { Role } from '../../database/entities/role.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { Department } from '../../database/entities/department.entity';
import { CreateTenantDto, UpdateTenantDto, OnboardTenantDto } from './dto/tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(Facility)
    private facilityRepository: Repository<Facility>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
    private dataSource: DataSource,
  ) {}

  async create(dto: CreateTenantDto): Promise<Tenant> {
    const tenant = this.tenantRepository.create({ ...dto, status: 'active' });
    return this.tenantRepository.save(tenant);
  }

  async findAll() {
    return this.tenantRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findOne(id);
    Object.assign(tenant, dto);
    return this.tenantRepository.save(tenant);
  }

  async remove(id: string): Promise<void> {
    const tenant = await this.findOne(id);
    await this.tenantRepository.softRemove(tenant);
  }

  /**
   * Onboard a new tenant: creates Tenant + Facility + Tenant Admin user + default departments
   */
  async onboard(dto: OnboardTenantDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create tenant
      const tenant = this.tenantRepository.create({
        name: dto.tenantName,
        description: dto.tenantDescription,
        status: 'active',
        settings: dto.settings || {},
      });
      const savedTenant = await queryRunner.manager.save(tenant);

      // 2. Create main facility
      const facility = this.facilityRepository.create({
        name: dto.facilityName,
        tenantId: savedTenant.id,
        type: dto.facilityType || 'hospital',
        location: dto.facilityLocation,
        status: 'active',
        settings: { isMainFacility: true },
      });
      const savedFacility = await queryRunner.manager.save(facility);

      // 3. Create default departments
      const defaultDepts = ['General Medicine', 'Emergency', 'Pharmacy', 'Laboratory', 'Radiology', 'Reception'];
      for (const deptName of defaultDepts) {
        const dept = this.departmentRepository.create({
          name: deptName,
          facilityId: savedFacility.id,
          status: 'active',
        });
        await queryRunner.manager.save(dept);
      }

      // 4. Create admin user
      const passwordHash = await bcrypt.hash(dto.adminPassword, 12);
      const adminUser = this.userRepository.create({
        username: dto.adminUsername,
        email: dto.adminEmail,
        fullName: dto.adminFullName,
        passwordHash,
        status: 'active',
        tenantId: savedTenant.id,
        facilityId: savedFacility.id,
      });
      const savedUser = await queryRunner.manager.save(adminUser);

      // 5. Assign Tenant Admin role
      const tenantAdminRole = await this.roleRepository.findOne({
        where: { name: 'Tenant Admin' },
      });
      if (tenantAdminRole) {
        const userRole = this.userRoleRepository.create({
          userId: savedUser.id,
          roleId: tenantAdminRole.id,
          facilityId: savedFacility.id,
        });
        await queryRunner.manager.save(userRole);
      }

      await queryRunner.commitTransaction();

      return {
        tenant: { id: savedTenant.id, name: savedTenant.name },
        facility: { id: savedFacility.id, name: savedFacility.name },
        admin: { id: savedUser.id, username: savedUser.username, email: savedUser.email },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
