import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { Role } from '../../database/entities/role.entity';
import { Employee } from '../../database/entities/employee.entity';
import { UserPermission } from '../../database/entities/user-permission.entity';
import { Permission } from '../../database/entities/permission.entity';
import { CreateUserDto, UpdateUserDto, AssignRoleDto, UserListQueryDto, AssignPermissionDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    @InjectRepository(UserPermission)
    private userPermissionRepository: Repository<UserPermission>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User & { employee?: Employee }> {
    const { employeeProfile, employeeId, roleId, facilityId, ...userData } = createUserDto;

    // VALIDATION: User must be linked to an employee (either existing or new profile)
    if (!employeeId && !employeeProfile) {
      throw new BadRequestException(
        'User must be linked to an employee. Provide either employeeId (to link to existing employee) or employeeProfile (to create new employee record).'
      );
    }

    // Check for duplicate username or email
    const existingUser = await this.userRepository.findOne({
      where: [{ username: userData.username }, { email: userData.email }],
    });

    if (existingUser) {
      throw new ConflictException('Username or email already exists');
    }

    // Validate role if provided
    if (roleId) {
      const role = await this.roleRepository.findOne({ where: { id: roleId } });
      if (!role) {
        throw new NotFoundException('Role not found');
      }
    }

    // If linking to existing employee, verify it exists and isn't already linked
    if (employeeId) {
      const existingEmployee = await this.employeeRepository.findOne({
        where: { id: employeeId },
      });
      if (!existingEmployee) {
        throw new NotFoundException('Employee not found');
      }
      if (existingEmployee.userId) {
        throw new ConflictException('Employee is already linked to a user account');
      }
    }

    // Use transaction to ensure atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Hash password
      const saltRoundsConfig = this.configService.get<string>('BCRYPT_ROUNDS', '12');
      const saltRounds = parseInt(saltRoundsConfig, 10) || 12;
      const passwordHash = await bcrypt.hash(userData.password, saltRounds);

      const user = this.userRepository.create({
        username: userData.username,
        email: userData.email,
        fullName: userData.fullName,
        phone: userData.phone,
        passwordHash,
        status: userData.status || 'active',
      });

      const savedUser = await queryRunner.manager.save(user);
      let employee: Employee | undefined;

      // Link to existing employee
      if (employeeId) {
        await queryRunner.manager.update(Employee, employeeId, { userId: savedUser.id });
        employee = await queryRunner.manager.findOne(Employee, { where: { id: employeeId } }) ?? undefined;
      }
      // Create new employee profile
      else if (employeeProfile) {
        const nameParts = userData.fullName.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || firstName;

        // Generate employee number
        const employeeCount = await queryRunner.manager.count(Employee);
        const employeeNumber = `EMP${String(employeeCount + 1).padStart(5, '0')}`;

        employee = this.employeeRepository.create({
          employeeNumber,
          userId: savedUser.id,
          firstName,
          lastName,
          email: userData.email,
          phone: userData.phone,
          dateOfBirth: new Date(employeeProfile.dateOfBirth),
          gender: employeeProfile.gender,
          jobTitle: employeeProfile.jobTitle,
          department: employeeProfile.department,
          staffCategory: employeeProfile.staffCategory,
          licenseNumber: employeeProfile.licenseNumber,
          specialization: employeeProfile.specialization,
          employmentType: employeeProfile.employmentType,
          hireDate: employeeProfile.hireDate ? new Date(employeeProfile.hireDate) : new Date(),
          basicSalary: employeeProfile.basicSalary || 0,
          facilityId: employeeProfile.facilityId,
        });

        await queryRunner.manager.save(employee);
      }

      // Assign role if provided
      if (roleId) {
        const userRole = this.userRoleRepository.create({
          userId: savedUser.id,
          roleId: roleId,
          facilityId: facilityId || undefined,
        });
        await queryRunner.manager.save(userRole);
      }

      await queryRunner.commitTransaction();

      return { ...savedUser, employee };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(query: UserListQueryDto) {
    const { page = 1, limit = 20, search, status } = query;
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (status) {
      whereClause.status = status;
    }

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (search) {
      queryBuilder.where(
        '(user.username ILIKE :search OR user.fullName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('user.status = :status', { status });
    }

    const [users, total] = await queryBuilder
      .leftJoinAndSelect('user.userRoles', 'userRole')
      .leftJoinAndSelect('userRole.role', 'role')
      .skip(skip)
      .take(limit)
      .orderBy('user.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: users.map((u) => this.sanitizeUser(u)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findOneWithRoles(id: string) {
    const user = await this.findOne(id);

    const userRoles = await this.userRoleRepository.find({
      where: { userId: id },
      relations: ['role', 'facility', 'department'],
    });

    // Get employee profile if linked
    const employee = await this.employeeRepository.findOne({
      where: { userId: id },
      relations: ['facility'],
    });

    return {
      ...this.sanitizeUser(user),
      roles: userRoles.map((ur) => ({
        id: ur.id,
        role: { id: ur.role.id, name: ur.role.name },
        facility: ur.facility ? { id: ur.facility.id, name: ur.facility.name } : null,
        department: ur.department ? { id: ur.department.id, name: ur.department.name } : null,
      })),
      employee: employee ? {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        jobTitle: employee.jobTitle,
        department: employee.department,
        staffCategory: employee.staffCategory,
        licenseNumber: employee.licenseNumber,
        specialization: employee.specialization,
        employmentType: employee.employmentType,
        status: employee.status,
        facility: employee.facility ? { id: employee.facility.id, name: employee.facility.name } : null,
      } : null,
    };
  }

  async linkUserToEmployee(userId: string, employeeId: string): Promise<Employee> {
    const user = await this.findOne(userId);
    
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (employee.userId && employee.userId !== userId) {
      throw new ConflictException('Employee is already linked to another user account');
    }

    // Check if user is already linked to another employee
    const existingLink = await this.employeeRepository.findOne({
      where: { userId },
    });

    if (existingLink && existingLink.id !== employeeId) {
      throw new ConflictException('User is already linked to another employee profile');
    }

    employee.userId = userId;
    return this.employeeRepository.save(employee);
  }

  async unlinkUserFromEmployee(userId: string): Promise<void> {
    const employee = await this.employeeRepository.findOne({
      where: { userId },
    });

    if (!employee) {
      throw new NotFoundException('No employee profile linked to this user');
    }

    employee.userId = undefined;
    await this.employeeRepository.save(employee);
  }

  async getEmployeeByUserId(userId: string): Promise<Employee | null> {
    return this.employeeRepository.findOne({
      where: { userId },
      relations: ['facility'],
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    // Check for duplicate username or email if they're being updated
    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const existing = await this.userRepository.findOne({
        where: { username: updateUserDto.username },
      });
      if (existing) {
        throw new ConflictException('Username already exists');
      }
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existing = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
      });
      if (existing) {
        throw new ConflictException('Email already exists');
      }
    }

    // Hash new password if provided
    if (updateUserDto.password) {
      const saltRoundsConfig = this.configService.get<string>('BCRYPT_ROUNDS', '12');
      const saltRounds = parseInt(saltRoundsConfig, 10) || 12;
      user.passwordHash = await bcrypt.hash(updateUserDto.password, saltRounds);
    }

    // Update other fields
    if (updateUserDto.username) user.username = updateUserDto.username;
    if (updateUserDto.fullName) user.fullName = updateUserDto.fullName;
    if (updateUserDto.email) user.email = updateUserDto.email;
    if (updateUserDto.phone !== undefined) user.phone = updateUserDto.phone;
    if (updateUserDto.status) user.status = updateUserDto.status;

    return this.userRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.softRemove(user);
  }

  async assignRole(userId: string, dto: AssignRoleDto): Promise<UserRole> {
    const user = await this.findOne(userId);
    const role = await this.roleRepository.findOne({ where: { id: dto.roleId } });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Check if role is already assigned with same scope
    const existing = await this.userRoleRepository.findOne({
      where: {
        userId,
        roleId: dto.roleId,
        facilityId: dto.facilityId || undefined,
      },
    });

    if (existing) {
      throw new ConflictException('Role already assigned');
    }

    const userRole = this.userRoleRepository.create({
      userId,
      roleId: dto.roleId,
      facilityId: dto.facilityId,
      departmentId: dto.departmentId,
    });

    return this.userRoleRepository.save(userRole);
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    const userRole = await this.userRoleRepository.findOne({
      where: { userId, roleId },
    });

    if (!userRole) {
      throw new NotFoundException('User role not found');
    }

    await this.userRoleRepository.remove(userRole);
  }

  async getUserRoles(userId: string): Promise<any[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ['role', 'facility'],
    });
    return userRoles.map(ur => ({
      id: ur.role.id,
      name: ur.role.name,
      description: ur.role.description,
      facilityId: ur.facilityId,
      facilityName: ur.facility?.name,
    }));
  }

  async activateUser(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.status = 'active';
    user.lockedUntil = undefined;
    user.failedLoginAttempts = 0;
    return this.userRepository.save(user);
  }

  async deactivateUser(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.status = 'inactive';
    return this.userRepository.save(user);
  }

  // Direct user permission management
  async getUserPermissions(userId: string): Promise<UserPermission[]> {
    await this.findOne(userId); // Verify user exists
    return this.userPermissionRepository.find({
      where: { userId },
      relations: ['permission'],
    });
  }

  async assignPermission(userId: string, dto: AssignPermissionDto, grantedBy: string): Promise<UserPermission> {
    await this.findOne(userId); // Verify user exists

    const permission = await this.permissionRepository.findOne({
      where: { id: dto.permissionId },
    });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    // Check if already assigned
    const existing = await this.userPermissionRepository.findOne({
      where: { userId, permissionId: dto.permissionId },
    });
    if (existing) {
      throw new ConflictException('Permission already assigned to this user');
    }

    const userPermission = this.userPermissionRepository.create({
      userId,
      permissionId: dto.permissionId,
      grantedBy,
      notes: dto.notes,
    });

    return this.userPermissionRepository.save(userPermission);
  }

  async removePermission(userId: string, permissionId: string): Promise<void> {
    const userPermission = await this.userPermissionRepository.findOne({
      where: { userId, permissionId },
    });
    if (!userPermission) {
      throw new NotFoundException('Permission not assigned to this user');
    }
    await this.userPermissionRepository.remove(userPermission);
  }

  async assignMultiplePermissions(userId: string, permissionIds: string[], grantedBy: string): Promise<UserPermission[]> {
    await this.findOne(userId); // Verify user exists

    const results: UserPermission[] = [];
    for (const permissionId of permissionIds) {
      try {
        const permission = await this.assignPermission(userId, { permissionId }, grantedBy);
        results.push(permission);
      } catch (error) {
        // Skip if already assigned
        if (!(error instanceof ConflictException)) {
          throw error;
        }
      }
    }
    return results;
  }

  async removeAllUserPermissions(userId: string): Promise<void> {
    await this.findOne(userId); // Verify user exists
    await this.userPermissionRepository.delete({ userId });
  }

  /**
   * Check if user has an associated employee record
   */
  async hasEmployeeRecord(userId: string): Promise<boolean> {
    const employee = await this.employeeRepository.findOne({
      where: { userId },
    });
    return !!employee;
  }

  /**
   * Get employee record for a user
   */
  async getEmployeeForUser(userId: string): Promise<Employee | null> {
    return this.employeeRepository.findOne({
      where: { userId },
      relations: ['facility'],
    });
  }

  /**
   * Validate user has employee profile - throws if not linked
   */
  async validateUserHasEmployee(userId: string): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({
      where: { userId },
      relations: ['facility'],
    });
    if (!employee) {
      throw new BadRequestException(
        'Your account is not linked to an employee profile. Please contact HR to complete your profile setup.'
      );
    }
    return employee;
  }

  private sanitizeUser(user: User) {
    const { passwordHash, mfaSecret, userRoles, ...sanitized } = user;
    return {
      ...sanitized,
      roles: userRoles?.map((ur: UserRole) => ({
        id: ur.role?.id,
        name: ur.role?.name,
      })) || [],
    };
  }
}
