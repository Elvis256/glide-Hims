import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { Role } from '../../database/entities/role.entity';
import { CreateUserDto, UpdateUserDto, AssignRoleDto, UserListQueryDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private configService: ConfigService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check for duplicate username or email
    const existingUser = await this.userRepository.findOne({
      where: [{ username: createUserDto.username }, { email: createUserDto.email }],
    });

    if (existingUser) {
      throw new ConflictException('Username or email already exists');
    }

    // Hash password
    const saltRounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(createUserDto.password, saltRounds);

    const user = this.userRepository.create({
      ...createUserDto,
      passwordHash,
      status: createUserDto.status || 'active',
    });

    return this.userRepository.save(user);
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

    return {
      ...this.sanitizeUser(user),
      roles: userRoles.map((ur) => ({
        id: ur.id,
        role: { id: ur.role.id, name: ur.role.name },
        facility: ur.facility ? { id: ur.facility.id, name: ur.facility.name } : null,
        department: ur.department ? { id: ur.department.id, name: ur.department.name } : null,
      })),
    };
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
      const saltRounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
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

  async removeRole(userId: string, userRoleId: string): Promise<void> {
    const userRole = await this.userRoleRepository.findOne({
      where: { id: userRoleId, userId },
    });

    if (!userRole) {
      throw new NotFoundException('User role not found');
    }

    await this.userRoleRepository.remove(userRole);
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

  private sanitizeUser(user: User) {
    const { passwordHash, mfaSecret, ...sanitized } = user;
    return sanitized;
  }
}
