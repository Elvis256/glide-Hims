import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { FacilitiesService, CreateUnitDto, UpdateUnitDto } from './facilities.service';
import { CreateFacilityDto, UpdateFacilityDto, CreateDepartmentDto, UpdateDepartmentDto } from './dto/facility.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('facilities')
@Controller('facilities')
export class FacilitiesController {
  constructor(private readonly facilitiesService: FacilitiesService) {}

  // Public endpoint for basic facility info (for patient cards, receipts, etc.)
  @Get('public/info')
  @Public()
  @ApiOperation({ summary: 'Get basic facility info (public - for printing)' })
  async getPublicInfo(@Query('facilityId') facilityId?: string) {
    let facility;
    if (facilityId) {
      try {
        facility = await this.facilitiesService.findOneFacility(facilityId);
      } catch {
        // fall through to default
      }
    }
    if (!facility) {
      const facilities = await this.facilitiesService.findAllFacilities();
      facility = facilities[0];
    }
    if (!facility) {
      return { name: 'Hospital', address: '', phone: '', email: '', logo: '', taxId: '' };
    }
    const settings = (facility.settings || {}) as Record<string, any>;
    return {
      name: facility.name,
      address: settings.address
        ? [settings.address.street, settings.address.city, settings.address.country].filter(Boolean).join(', ')
        : facility.location || '',
      phone: facility.contact?.phone || '',
      email: facility.contact?.email || '',
      logo: settings.logo || '',
      taxId: settings.taxId || '',
    };
  }

  @Post()
  @AuthWithPermissions('facilities.create')
  @ApiOperation({ summary: 'Create facility' })
  async createFacility(@Body() dto: CreateFacilityDto, @Request() req: any) {
    const facility = await this.facilitiesService.createFacility(dto, req.user?.tenantId);
    return { message: 'Facility created', data: facility };
  }

  @Get()
  @AuthWithPermissions('facilities.read')
  @ApiOperation({ summary: 'List facilities scoped to the current user\'s tenant' })
  async findAllFacilities(@Request() req: any) {
    const facilityId = req.user?.facilityId;
    return this.facilitiesService.findFacilitiesForUser(facilityId);
  }

  // Departments - static routes must come before parameterized routes
  @Get('departments')
  @AuthWithPermissions('facilities.read')
  @ApiOperation({ summary: 'List all departments across facilities' })
  async findAllDepartmentsGlobal(@Request() req: any) {
    return this.facilitiesService.findAllDepartmentsGlobal(req.user?.tenantId);
  }

  // Units - static routes
  @Get('units/:id')
  @AuthWithPermissions('facilities.read')
  @ApiOperation({ summary: 'Get unit by ID' })
  async findOneUnit(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.facilitiesService.findOneUnit(id, req.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('facilities.read')
  @ApiOperation({ summary: 'Get facility by ID' })
  async findOneFacility(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.facilitiesService.findOneFacility(id, req.user?.tenantId);
  }

  @Patch(':id')
  @AuthWithPermissions('facilities.update')
  @ApiOperation({ summary: 'Update facility' })
  async updateFacility(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFacilityDto, @Request() req: any) {
    const facility = await this.facilitiesService.updateFacility(id, dto, req.user?.tenantId);
    return { message: 'Facility updated', data: facility };
  }

  @Delete(':id')
  @AuthWithPermissions('facilities.delete')
  @ApiOperation({ summary: 'Delete facility' })
  async removeFacility(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    await this.facilitiesService.removeFacility(id, req.user?.tenantId);
    return { message: 'Facility deleted' };
  }

  @Post(':facilityId/departments')
  @AuthWithPermissions('facilities.create')
  @ApiOperation({ summary: 'Create department' })
  async createDepartment(
    @Param('facilityId', ParseUUIDPipe) facilityId: string,
    @Body() dto: CreateDepartmentDto,
    @Request() req: any,
  ) {
    dto.facilityId = facilityId;
    const department = await this.facilitiesService.createDepartment(dto, req.user?.tenantId);
    return { message: 'Department created', data: department };
  }

  @Get(':facilityId/departments')
  @AuthWithPermissions('facilities.read')
  @ApiOperation({ summary: 'List departments for facility' })
  async findAllDepartments(@Param('facilityId', ParseUUIDPipe) facilityId: string, @Request() req: any) {
    return this.facilitiesService.findAllDepartments(facilityId, req.user?.tenantId);
  }

  @Patch('departments/:id')
  @AuthWithPermissions('facilities.update')
  @ApiOperation({ summary: 'Update department' })
  async updateDepartment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDepartmentDto, @Request() req: any) {
    const department = await this.facilitiesService.updateDepartment(id, dto, req.user?.tenantId);
    return { message: 'Department updated', data: department };
  }

  @Delete('departments/:id')
  @AuthWithPermissions('facilities.delete')
  @ApiOperation({ summary: 'Delete department' })
  async removeDepartment(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    await this.facilitiesService.removeDepartment(id, req.user?.tenantId);
    return { message: 'Department deleted' };
  }

  // Units
  @Post('departments/:departmentId/units')
  @AuthWithPermissions('facilities.create')
  @ApiOperation({ summary: 'Create unit' })
  async createUnit(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() dto: CreateUnitDto,
    @Request() req: any,
  ) {
    dto.departmentId = departmentId;
    const unit = await this.facilitiesService.createUnit(dto, req.user?.tenantId);
    return { message: 'Unit created', data: unit };
  }

  @Get('departments/:departmentId/staff')
  @AuthWithPermissions('facilities.read')
  @ApiOperation({ summary: 'Get staff assigned to department' })
  async getDepartmentStaff(@Param('departmentId', ParseUUIDPipe) departmentId: string, @Request() req: any) {
    return this.facilitiesService.getDepartmentStaff(departmentId, req.user?.tenantId);
  }

  @Get('departments/:departmentId/units')
  @AuthWithPermissions('facilities.read')
  @ApiOperation({ summary: 'List units for department' })
  async findAllUnits(@Param('departmentId', ParseUUIDPipe) departmentId: string, @Request() req: any) {
    return this.facilitiesService.findAllUnits(departmentId, req.user?.tenantId);
  }

  @Get(':facilityId/units')
  @AuthWithPermissions('facilities.read')
  @ApiOperation({ summary: 'List all units for facility' })
  async findUnitsByFacility(@Param('facilityId', ParseUUIDPipe) facilityId: string, @Request() req: any) {
    return this.facilitiesService.findUnitsByFacility(facilityId, req.user?.tenantId);
  }

  @Patch('units/:id')
  @AuthWithPermissions('facilities.update')
  @ApiOperation({ summary: 'Update unit' })
  async updateUnit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUnitDto, @Request() req: any) {
    const unit = await this.facilitiesService.updateUnit(id, dto, req.user?.tenantId);
    return { message: 'Unit updated', data: unit };
  }

  @Delete('units/:id')
  @AuthWithPermissions('facilities.delete')
  @ApiOperation({ summary: 'Delete unit' })
  async removeUnit(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    await this.facilitiesService.removeUnit(id, req.user?.tenantId);
    return { message: 'Unit deleted' };
  }

  // ─── Per-facility module/service configuration ───────────────────────────

  @Get(':id/modules')
  @AuthWithPermissions('facilities.read')
  @ApiOperation({ summary: 'Get enabled modules for a facility' })
  async getFacilityModules(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.facilitiesService.getFacilityModules(id, req.user?.tenantId);
  }

  @Patch(':id/modules')
  @AuthWithPermissions('facilities.update')
  @ApiOperation({ summary: 'Update enabled modules for a facility' })
  async updateFacilityModules(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { enabledModules: string[]; sharedModules?: string[] },
    @Request() req: any,
  ) {
    return this.facilitiesService.updateFacilityModules(id, body.enabledModules, body.sharedModules, req.user?.tenantId);
  }
}
