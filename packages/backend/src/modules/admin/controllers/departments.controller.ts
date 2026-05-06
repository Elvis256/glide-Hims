import { Controller, Get, Query } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Department } from '../../../database/entities/department.entity';

@Controller('departments')
export class DepartmentsController {
  constructor(
    @InjectRepository(Department)
    private departmentsRepository: Repository<Department>,
  ) {}

  @Get()
  async getDepartments(@Query('facilityId') facilityId?: string) {
    const where: any = { status: 'active' };
    if (facilityId) {
      where.facilityId = facilityId;
    }
    return this.departmentsRepository.find({
      where,
      order: { name: 'ASC' },
    });
  }
}
