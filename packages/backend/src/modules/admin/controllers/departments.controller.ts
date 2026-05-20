import { Controller, Get, Query, Request } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Department } from '../../../database/entities/department.entity';
import { AuthWithPermissions } from '../../auth/decorators/auth.decorator';

@ApiTags('departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(
    @InjectRepository(Department)
    private departmentsRepository: Repository<Department>,
  ) {}

  @Get()
  @AuthWithPermissions('facilities.read')
  async getDepartments(@Request() req: any, @Query('facilityId') facilityId?: string) {
    const where: any = { status: 'active' };
    // Tenant scoping — without it any authed user could enumerate
    // departments across other tenants by guessing facility UUIDs.
    const tenantId = req?.user?.tenantId;
    if (tenantId) where.tenantId = tenantId;
    if (facilityId) where.facilityId = facilityId;
    return this.departmentsRepository.find({
      where,
      order: { name: 'ASC' },
    });
  }
}
