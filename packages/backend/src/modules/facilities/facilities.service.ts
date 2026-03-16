import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Facility } from '../../database/entities/facility.entity';
import { Department } from '../../database/entities/department.entity';
import { Unit } from '../../database/entities/unit.entity';
import { User } from '../../database/entities/user.entity';
import { CreateFacilityDto, UpdateFacilityDto, CreateDepartmentDto, UpdateDepartmentDto } from './dto/facility.dto';

export interface CreateUnitDto {
  facilityId: string;
  departmentId: string;
  name: string;
  code: string;
  description?: string;
  headUserId?: string;
  location?: string;
}

export interface UpdateUnitDto {
  name?: string;
  description?: string;
  headUserId?: string;
  location?: string;
  status?: string;
}

@Injectable()
export class FacilitiesService {
  constructor(
    @InjectRepository(Facility)
    private facilityRepository: Repository<Facility>,
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
    @InjectRepository(Unit)
    private unitRepository: Repository<Unit>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // Facility CRUD
  async createFacility(dto: CreateFacilityDto, tenantId?: string): Promise<Facility> {
    const facility = this.facilityRepository.create({ ...dto, status: 'active', ...(tenantId ? { tenantId } : {}) });
    return this.facilityRepository.save(facility);
  }

  async findAllFacilities(tenantId?: string) {
    const query = this.facilityRepository.createQueryBuilder('facility')
      .leftJoinAndSelect('facility.parentFacility', 'parent');
    
    if (tenantId) {
      query.where('facility.tenantId = :tenantId', { tenantId });
    }
    
    return query.orderBy('facility.name', 'ASC').getMany();
  }

  async findFacilitiesForUser(userFacilityId?: string, tenantId?: string) {
    if (!userFacilityId) return [];
    const userFacility = await this.facilityRepository.findOne({ where: { id: userFacilityId , ...(tenantId ? { tenantId } : {}) } });
    if (!userFacility) return [];
    return this.findAllFacilities(userFacility.tenantId);
  }

  async findOneFacility(id: string, tenantId?: string): Promise<Facility> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const facility = await this.facilityRepository.findOne({
      where,
      relations: ['parentFacility'],
    });
    if (!facility) throw new NotFoundException('Facility not found');
    return facility;
  }

  async updateFacility(id: string, dto: UpdateFacilityDto, tenantId?: string): Promise<Facility> {
    const facility = await this.findOneFacility(id, tenantId);
    Object.assign(facility, dto);
    return this.facilityRepository.save(facility);
  }

  async removeFacility(id: string, tenantId?: string): Promise<void> {
    const facility = await this.findOneFacility(id, tenantId);
    await this.facilityRepository.softRemove(facility);
  }

  // Department CRUD
  async createDepartment(dto: CreateDepartmentDto, tenantId?: string): Promise<Department> {
    const codeWhere: any = { code: dto.code };
    if (tenantId) codeWhere.tenantId = tenantId;
    const existing = await this.departmentRepository.findOne({ where: codeWhere });
    if (existing) throw new ConflictException('Department code already exists');
    
    const department = this.departmentRepository.create({ ...dto, status: 'active', ...(tenantId ? { tenantId } : {}) });
    return this.departmentRepository.save(department);
  }

  private sanitizeDepartments(departments: Department[], countMap: Map<string, number>) {
    return departments.map(d => {
      const { headUser, ...rest } = d as any;
      return {
        ...rest,
        staffCount: countMap.get(d.id) || 0,
        headUser: headUser ? { id: headUser.id, fullName: headUser.fullName, username: headUser.username, email: headUser.email } : null,
      };
    });
  }

  async findAllDepartments(facilityId: string, tenantId?: string) {
    const where: any = { facilityId };
    if (tenantId) where.tenantId = tenantId;
    const departments = await this.departmentRepository.find({
      where,
      order: { name: 'ASC' },
      relations: ['children', 'headUser'],
    });
    
    if (departments.length === 0) return [];
    
    const deptIds = departments.map(d => d.id);
    const staffCounts = await this.userRepository
      .createQueryBuilder('user')
      .select('user.departmentId', 'departmentId')
      .addSelect('COUNT(user.id)', 'count')
      .where('user.departmentId IN (:...deptIds)', { deptIds })
      .groupBy('user.departmentId')
      .getRawMany();
    
    const countMap = new Map(staffCounts.map(c => [c.departmentId, parseInt(c.count)]));
    
    return this.sanitizeDepartments(departments, countMap);
  }

  async findAllDepartmentsGlobal(tenantId?: string) {
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    const departments = await this.departmentRepository.find({
      where,
      order: { name: 'ASC' },
      relations: ['facility', 'children', 'parent', 'headUser'],
    });
    
    if (departments.length === 0) return [];
    
    const deptIds = departments.map(d => d.id);
    const staffCounts = await this.userRepository
      .createQueryBuilder('user')
      .select('user.departmentId', 'departmentId')
      .addSelect('COUNT(user.id)', 'count')
      .where('user.departmentId IN (:...deptIds)', { deptIds })
      .groupBy('user.departmentId')
      .getRawMany();
    
    const countMap = new Map(staffCounts.map(c => [c.departmentId, parseInt(c.count)]));
    
    return this.sanitizeDepartments(departments, countMap);
  }

  async findOneDepartment(id: string, tenantId?: string): Promise<any> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const department = await this.departmentRepository.findOne({ 
      where,
      relations: ['children', 'facility', 'headUser'],
    });
    if (!department) throw new NotFoundException('Department not found');
    
    // Get staff count
    const staffCountWhere: any = { departmentId: id };
    if (tenantId) staffCountWhere.tenantId = tenantId;
    const staffCount = await this.userRepository.count({ where: staffCountWhere });
    
    const { headUser, ...rest } = department as any;
    return {
      ...rest,
      staffCount,
      headUser: headUser ? { id: headUser.id, fullName: headUser.fullName, username: headUser.username, email: headUser.email } : null,
    };
  }

  async getDepartmentStaff(departmentId: string, tenantId?: string) {
    const where: any = { departmentId };
    if (tenantId) where.tenantId = tenantId;
    const users = await this.userRepository.find({
      where,
      order: { fullName: 'ASC' },
    });
    return users.map(u => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      staffCategory: u.staffCategory,
      status: u.status,
    }));
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto, tenantId?: string): Promise<any> {
    const deptWhere: any = { id };
    if (tenantId) deptWhere.tenantId = tenantId;
    const department = await this.departmentRepository.findOne({ where: deptWhere });
    if (!department) throw new NotFoundException('Department not found');
    // Explicitly handle headUserId null to allow removing head
    if ('headUserId' in dto) {
      department.headUserId = dto.headUserId ?? null;
    }
    const { headUserId, ...rest } = dto;
    Object.assign(department, rest);
    await this.departmentRepository.save(department);
    return this.findOneDepartment(id, tenantId);
  }

  async removeDepartment(id: string, tenantId?: string): Promise<void> {
    const department = await this.findOneDepartment(id, tenantId);
    await this.departmentRepository.softRemove(department);
  }

  // Unit CRUD
  async createUnit(dto: CreateUnitDto, tenantId?: string): Promise<Unit> {
    const existing = await this.unitRepository.findOne({
      where: { departmentId: dto.departmentId, code: dto.code },
    });
    if (existing) throw new ConflictException('Unit code already exists in this department');

    const unit = this.unitRepository.create({ ...dto, status: 'active', ...(tenantId ? { tenantId } : {}) });
    return this.unitRepository.save(unit);
  }

  async findAllUnits(departmentId: string, tenantId?: string) {
    const where: any = { departmentId };
    if (tenantId) where.tenantId = tenantId;
    return this.unitRepository.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async findUnitsByFacility(facilityId: string, tenantId?: string) {
    const where: any = { facilityId };
    if (tenantId) where.tenantId = tenantId;
    return this.unitRepository.find({
      where,
      relations: ['department'],
      order: { name: 'ASC' },
    });
  }

  async findOneUnit(id: string, tenantId?: string): Promise<Unit> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const unit = await this.unitRepository.findOne({
      where,
      relations: ['department'],
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  async updateUnit(id: string, dto: UpdateUnitDto, tenantId?: string): Promise<Unit> {
    const unit = await this.findOneUnit(id, tenantId);
    Object.assign(unit, dto);
    return this.unitRepository.save(unit);
  }

  async removeUnit(id: string, tenantId?: string): Promise<void> {
    const unit = await this.findOneUnit(id, tenantId);
    await this.unitRepository.softRemove(unit);
  }

  // ─── Per-facility module/service configuration ───────────────────────────

  /**
   * All modules the platform supports. Used as the default "full" set.
   */
  private static readonly ALL_MODULES = [
    'patients', 'encounters', 'vitals', 'lab', 'pharmacy', 'radiology',
    'billing', 'inventory', 'insurance', 'reports', 'appointments',
    'ipd', 'emergency', 'theatre', 'maternity', 'hr', 'finance',
  ];

  /**
   * Return the enabled modules for a facility.
   * Falls back to the tenant-level setting stored on the facility's settings JSON.
   */
  async getFacilityModules(facilityId: string, tenantId?: string): Promise<{
    enabledModules: string[];
    sharedModules: string[];
    allModules: string[];
  }> {
    const facility = await this.findOneFacility(facilityId, tenantId);
    const enabledModules: string[] =
      (facility.settings?.enabledModules as string[]) ||
      FacilitiesService.ALL_MODULES;
    const sharedModules: string[] =
      (facility.settings?.sharedModules as string[]) || [];
    return {
      enabledModules,
      sharedModules,
      allModules: FacilitiesService.ALL_MODULES,
    };
  }

  /**
   * Persist the enabled (and optionally shared) module list for a facility.
   * "sharedModules" are modules that this branch consumes from the main/central facility
   * rather than running its own (e.g., a branch that sends lab samples to the main lab).
   */
  async updateFacilityModules(
    facilityId: string,
    enabledModules: string[],
    sharedModules: string[] = [],
    tenantId?: string,
  ): Promise<{ enabledModules: string[]; sharedModules: string[] }> {
    const facility = await this.findOneFacility(facilityId, tenantId);
    facility.settings = {
      ...(facility.settings || {}),
      enabledModules,
      sharedModules,
    };
    await this.facilityRepository.save(facility);
    return { enabledModules, sharedModules };
  }
}
