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
  async getDepartments(@Query('facilityId') facilityId: string) {
    if (!facilityId) {
      return [];
    }

    const departments = await this.departmentsRepository.find({
      where: { facilityId, status: 'active' },
      order: { name: 'ASC' },
    });

    return {
      statusCode: 200,
      data: departments,
      timestamp: new Date().toISOString(),
    };
  }
}
