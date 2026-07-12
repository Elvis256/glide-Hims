import { Controller, Get, Query, Request } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Department } from '../../../database/entities/department.entity';
import { AuthWithPermissions } from '../../auth/decorators/auth.decorator';
import { requireTenantId } from '../../../common/utils/tenant.util';

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
    const tenantId = req?.user?.tenantId;
    const tid = requireTenantId(tenantId);
    where.tenantId = tid;
    if (facilityId) where.facilityId = facilityId;
    return this.departmentsRepository.find({
      where,
      order: { name: 'ASC' },
    });
  }
}
