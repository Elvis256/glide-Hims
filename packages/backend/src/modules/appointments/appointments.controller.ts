import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireFacilityAccess } from '../auth/decorators/facility-access.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AppointmentsService } from './appointments.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  AppointmentQueryDto,
  UpdateAppointmentStatusDto,
} from './dto/appointment.dto';
import { AppointmentStatus } from './entities/appointment.entity';

@ApiTags('Appointments')
@ApiBearerAuth()
@RequireFacilityAccess()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @AuthWithPermissions('appointments.create')
  @ApiOperation({ summary: 'Create a new appointment' })
  create(
    @Body() dto: CreateAppointmentDto,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: { id: string },
    @Request() req: any,
  ) {
    return this.appointmentsService.create(dto, facilityId, user.id, req.user?.tenantId);
  }

  @Get()
  @AuthWithPermissions('appointments.read')
  @ApiOperation({ summary: 'Get all appointments with filters' })
  findAll(
    @Query() query: AppointmentQueryDto,
    @Headers('x-facility-id') facilityId: string,
    @Request() req: any,
  ) {
    return this.appointmentsService.findAll(query, facilityId, req.user?.tenantId);
  }

  @Get('stats')
  @AuthWithPermissions('appointments.read')
  @ApiOperation({ summary: 'Get appointment statistics' })
  getStats(
    @Query('date') date: string,
    @Headers('x-facility-id') facilityId: string,
    @Request() req: any,
  ) {
    return this.appointmentsService.getStats(facilityId, date, req.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('appointments.read')
  @ApiOperation({ summary: 'Get appointment by ID' })
  findOne(
    @Param('id') id: string,
    @Headers('x-facility-id') facilityId: string,
    @Request() req: any,
  ) {
    return this.appointmentsService.findOne(id, facilityId, req.user?.tenantId);
  }

  @Put(':id')
  @AuthWithPermissions('appointments.update')
  @ApiOperation({ summary: 'Update an appointment' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @Headers('x-facility-id') facilityId: string,
    @Request() req: any,
  ) {
    return this.appointmentsService.update(id, dto, facilityId, req.user?.tenantId);
  }

  @Patch(':id/status')
  @AuthWithPermissions('appointments.update')
  @ApiOperation({ summary: 'Update appointment status' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateAppointmentStatusDto,
    @Headers('x-facility-id') facilityId: string,
    @Request() req: any,
  ) {
    return this.appointmentsService.updateStatus(
      id,
      body.status,
      facilityId,
      body.cancellationReason,
      req.user?.tenantId,
    );
  }

  @Delete(':id')
  @AuthWithPermissions('appointments.delete')
  @ApiOperation({ summary: 'Delete an appointment' })
  delete(
    @Param('id') id: string,
    @Headers('x-facility-id') facilityId: string,
    @Request() req: any,
  ) {
    return this.appointmentsService.delete(id, facilityId, req.user?.tenantId);
  }
}
