import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { SchedulesService } from './schedules.service';
import { CreateDoctorScheduleDto, UpdateDoctorScheduleDto, ScheduleQueryDto } from './dto/schedule.dto';

@ApiTags('Schedules')
@ApiBearerAuth()
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  @AuthWithPermissions('schedules:create')
  @ApiOperation({ summary: 'Create a doctor schedule' })
  create(
    @Body() dto: CreateDoctorScheduleDto,
    @Headers('x-facility-id') facilityId: string,
  ) {
    return this.schedulesService.create(dto, facilityId);
  }

  @Get()
  @AuthWithPermissions('schedules:read')
  @ApiOperation({ summary: 'Get all doctor schedules' })
  findAll(
    @Query() query: ScheduleQueryDto,
    @Headers('x-facility-id') facilityId: string,
  ) {
    return this.schedulesService.findAll(query, facilityId);
  }

  @Get('doctors')
  @AuthWithPermissions('schedules:read')
  @ApiOperation({ summary: 'Get doctors with schedules' })
  getDoctorsWithSchedules(@Headers('x-facility-id') facilityId: string) {
    return this.schedulesService.getDoctorsWithSchedules(facilityId);
  }

  @Get(':id')
  @AuthWithPermissions('schedules:read')
  @ApiOperation({ summary: 'Get schedule by ID' })
  findOne(
    @Param('id') id: string,
    @Headers('x-facility-id') facilityId: string,
  ) {
    return this.schedulesService.findOne(id, facilityId);
  }

  @Put(':id')
  @AuthWithPermissions('schedules:update')
  @ApiOperation({ summary: 'Update a schedule' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDoctorScheduleDto,
    @Headers('x-facility-id') facilityId: string,
  ) {
    return this.schedulesService.update(id, dto, facilityId);
  }

  @Delete(':id')
  @AuthWithPermissions('schedules:delete')
  @ApiOperation({ summary: 'Delete a schedule' })
  delete(
    @Param('id') id: string,
    @Headers('x-facility-id') facilityId: string,
  ) {
    return this.schedulesService.delete(id, facilityId);
  }
}
