import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { FacilitiesService, CreateUnitDto, UpdateUnitDto } from './facilities.service';
import { CreateFacilityDto, UpdateFacilityDto, CreateDepartmentDto, UpdateDepartmentDto } from './dto/facility.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@ApiTags('facilities')
@Controller('facilities')
export class FacilitiesController {
  constructor(private readonly facilitiesService: FacilitiesService) {}

  @Post()
  @AuthWithPermissions('facilities.create')
  @ApiOperation({ summary: 'Create facility' })
  async createFacility(@Body() dto: CreateFacilityDto) {
    const facility = await this.facilitiesService.createFacility(dto);
    return { message: 'Facility created', data: facility };
  }

  @Get()
  @AuthWithPermissions('facilities.read')
  @ApiOperation({ summary: 'List all facilities' })
  @ApiQuery({ name: 'tenantId', required: false })
  async findAllFacilities(@Query('tenantId') tenantId?: string) {
    return this.facilitiesService.findAllFacilities(tenantId);
  }

  // Departments - static routes must come before parameterized routes
  @Get('departments')
  @AuthWithPermissions('facilities.read')
  @ApiOperation({ summary: 'List all departments across facilities' })
  async findAllDepartmentsGlobal() {
    return this.facilitiesService.findAllDepartmentsGlobal();
  }

  // Units - static routes
  @Get('units/:id')
  @AuthWithPermissions('facilities.read')
  @ApiOperation({ summary: 'Get unit by ID' })
  async findOneUnit(@Param('id', ParseUUIDPipe) id: string) {
    return this.facilitiesService.findOneUnit(id);
  }

  @Get(':id')
  @AuthWithPermissions('facilities.read')
  @ApiOperation({ summary: 'Get facility by ID' })
  async findOneFacility(@Param('id', ParseUUIDPipe) id: string) {
    return this.facilitiesService.findOneFacility(id);
  }

  @Patch(':id')
  @AuthWithPermissions('facilities.update')
  @ApiOperation({ summary: 'Update facility' })
  async updateFacility(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFacilityDto) {
    const facility = await this.facilitiesService.updateFacility(id, dto);
    return { message: 'Facility updated', data: facility };
  }

  @Delete(':id')
  @AuthWithPermissions('facilities.delete')
  @ApiOperation({ summary: 'Delete facility' })
  async removeFacility(@Param('id', ParseUUIDPipe) id: string) {
    await this.facilitiesService.removeFacility(id);
    return { message: 'Facility deleted' };
  }

  @Post(':facilityId/departments')
  @AuthWithPermissions('facilities.create')
  @ApiOperation({ summary: 'Create department' })
  async createDepartment(
    @Param('facilityId', ParseUUIDPipe) facilityId: string,
    @Body() dto: CreateDepartmentDto,
  ) {
    dto.facilityId = facilityId;
    const department = await this.facilitiesService.createDepartment(dto);
    return { message: 'Department created', data: department };
  }

  @Get(':facilityId/departments')
  @AuthWithPermissions('facilities.read')
  @ApiOperation({ summary: 'List departments for facility' })
  async findAllDepartments(@Param('facilityId', ParseUUIDPipe) facilityId: string) {
    return this.facilitiesService.findAllDepartments(facilityId);
  }

  @Patch('departments/:id')
  @AuthWithPermissions('facilities.update')
  @ApiOperation({ summary: 'Update department' })
  async updateDepartment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDepartmentDto) {
    const department = await this.facilitiesService.updateDepartment(id, dto);
    return { message: 'Department updated', data: department };
  }

  @Delete('departments/:id')
  @AuthWithPermissions('facilities.delete')
  @ApiOperation({ summary: 'Delete department' })
  async removeDepartment(@Param('id', ParseUUIDPipe) id: string) {
    await this.facilitiesService.removeDepartment(id);
    return { message: 'Department deleted' };
  }

  // Units
  @Post('departments/:departmentId/units')
  @AuthWithPermissions('facilities.create')
  @ApiOperation({ summary: 'Create unit' })
  async createUnit(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() dto: CreateUnitDto,
  ) {
    dto.departmentId = departmentId;
    const unit = await this.facilitiesService.createUnit(dto);
    return { message: 'Unit created', data: unit };
  }

  @Get('departments/:departmentId/units')
  @AuthWithPermissions('facilities.read')
  @ApiOperation({ summary: 'List units for department' })
  async findAllUnits(@Param('departmentId', ParseUUIDPipe) departmentId: string) {
    return this.facilitiesService.findAllUnits(departmentId);
  }

  @Get(':facilityId/units')
  @AuthWithPermissions('facilities.read')
  @ApiOperation({ summary: 'List all units for facility' })
  async findUnitsByFacility(@Param('facilityId', ParseUUIDPipe) facilityId: string) {
    return this.facilitiesService.findUnitsByFacility(facilityId);
  }

  @Patch('units/:id')
  @AuthWithPermissions('facilities.update')
  @ApiOperation({ summary: 'Update unit' })
  async updateUnit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUnitDto) {
    const unit = await this.facilitiesService.updateUnit(id, dto);
    return { message: 'Unit updated', data: unit };
  }

  @Delete('units/:id')
  @AuthWithPermissions('facilities.delete')
  @ApiOperation({ summary: 'Delete unit' })
  async removeUnit(@Param('id', ParseUUIDPipe) id: string) {
    await this.facilitiesService.removeUnit(id);
    return { message: 'Unit deleted' };
  }
}
