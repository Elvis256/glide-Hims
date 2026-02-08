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
  async createFacility(dto: CreateFacilityDto): Promise<Facility> {
    const facility = this.facilityRepository.create({ ...dto, status: 'active' });
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

  async findOneFacility(id: string): Promise<Facility> {
    const facility = await this.facilityRepository.findOne({
      where: { id },
      relations: ['parentFacility'],
    });
    if (!facility) throw new NotFoundException('Facility not found');
    return facility;
  }

  async updateFacility(id: string, dto: UpdateFacilityDto): Promise<Facility> {
    const facility = await this.findOneFacility(id);
    Object.assign(facility, dto);
    return this.facilityRepository.save(facility);
  }

  async removeFacility(id: string): Promise<void> {
    const facility = await this.findOneFacility(id);
    await this.facilityRepository.softRemove(facility);
  }

  // Department CRUD
  async createDepartment(dto: CreateDepartmentDto): Promise<Department> {
    const existing = await this.departmentRepository.findOne({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Department code already exists');
    
    const department = this.departmentRepository.create({ ...dto, status: 'active' });
    return this.departmentRepository.save(department);
  }

  async findAllDepartments(facilityId: string) {
    const departments = await this.departmentRepository.find({
      where: { facilityId },
      order: { name: 'ASC' },
      relations: ['children'],
    });
    
    // Get staff counts for each department
    const deptIds = departments.map(d => d.id);
    const staffCounts = await this.userRepository
      .createQueryBuilder('user')
      .select('user.departmentId', 'departmentId')
      .addSelect('COUNT(user.id)', 'count')
      .where('user.departmentId IN (:...deptIds)', { deptIds: deptIds.length ? deptIds : ['none'] })
      .groupBy('user.departmentId')
      .getRawMany();
    
    const countMap = new Map(staffCounts.map(c => [c.departmentId, parseInt(c.count)]));
    
    return departments.map(d => ({
      ...d,
      staffCount: countMap.get(d.id) || 0,
    }));
  }

  async findAllDepartmentsGlobal() {
    const departments = await this.departmentRepository.find({
      order: { name: 'ASC' },
      relations: ['facility', 'children', 'parent'],
    });
    
    // Get staff counts for each department
    const deptIds = departments.map(d => d.id);
    const staffCounts = await this.userRepository
      .createQueryBuilder('user')
      .select('user.departmentId', 'departmentId')
      .addSelect('COUNT(user.id)', 'count')
      .where('user.departmentId IN (:...deptIds)', { deptIds: deptIds.length ? deptIds : ['none'] })
      .groupBy('user.departmentId')
      .getRawMany();
    
    const countMap = new Map(staffCounts.map(c => [c.departmentId, parseInt(c.count)]));
    
    return departments.map(d => ({
      ...d,
      staffCount: countMap.get(d.id) || 0,
    }));
  }

  async findOneDepartment(id: string): Promise<any> {
    const department = await this.departmentRepository.findOne({ 
      where: { id },
      relations: ['children', 'facility'],
    });
    if (!department) throw new NotFoundException('Department not found');
    
    // Get staff count
    const staffCount = await this.userRepository.count({ where: { departmentId: id } });
    
    return {
      ...department,
      staffCount,
    };
  }

  async getDepartmentStaff(departmentId: string) {
    return this.userRepository.find({
      where: { departmentId },
      select: ['id', 'fullName', 'email', 'phone', 'employeeNumber', 'jobTitle', 'staffCategory', 'status'],
      order: { fullName: 'ASC' },
    });
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto): Promise<Department> {
    const department = await this.findOneDepartment(id);
    Object.assign(department, dto);
    return this.departmentRepository.save(department);
  }

  async removeDepartment(id: string): Promise<void> {
    const department = await this.findOneDepartment(id);
    await this.departmentRepository.softRemove(department);
  }

  // Unit CRUD
  async createUnit(dto: CreateUnitDto): Promise<Unit> {
    const existing = await this.unitRepository.findOne({
      where: { departmentId: dto.departmentId, code: dto.code },
    });
    if (existing) throw new ConflictException('Unit code already exists in this department');

    const unit = this.unitRepository.create({ ...dto, status: 'active' });
    return this.unitRepository.save(unit);
  }

  async findAllUnits(departmentId: string) {
    return this.unitRepository.find({
      where: { departmentId },
      order: { name: 'ASC' },
    });
  }

  async findUnitsByFacility(facilityId: string) {
    return this.unitRepository.find({
      where: { facilityId },
      relations: ['department'],
      order: { name: 'ASC' },
    });
  }

  async findOneUnit(id: string): Promise<Unit> {
    const unit = await this.unitRepository.findOne({
      where: { id },
      relations: ['department'],
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  async updateUnit(id: string, dto: UpdateUnitDto): Promise<Unit> {
    const unit = await this.findOneUnit(id);
    Object.assign(unit, dto);
    return this.unitRepository.save(unit);
  }

  async removeUnit(id: string): Promise<void> {
    const unit = await this.findOneUnit(id);
    await this.unitRepository.softRemove(unit);
  }
}
