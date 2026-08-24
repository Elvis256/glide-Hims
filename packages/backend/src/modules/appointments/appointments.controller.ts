import {
  BadRequestException,
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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireFacilityAccess } from '../auth/decorators/facility-access.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';
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
@RequireModule('registration')
@RequireFacilityAccess()
@UseGuards(ModuleGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  /**
   * The facility to act in.
   *
   * These handlers took the facility from the `x-facility-id` header ALONE,
   * unlike every other controller, which falls back to the facility on the
   * authenticated user. A client that did not send the header — a user with no
   * facility chosen, any non-browser caller — got a 500 from a NOT NULL
   * violation when booking, and, worse, an empty page with HTTP 200 when
   * listing: no appointments at all, reported as success.
   */
  private resolveFacility(header: string | undefined, req: any): string {
    const facilityId = header || req?.user?.facilityId;
    if (!facilityId) {
      throw new BadRequestException(
        'No facility context — send x-facility-id or sign in against a facility',
      );
    }
    return facilityId;
  }

  @Post()
  @AuthWithPermissions('appointments.create')
  @ApiOperation({ summary: 'Create a new appointment' })
  create(
    @Body() dto: CreateAppointmentDto,
    @Headers('x-facility-id') facilityIdHeader: string,
    @CurrentUser() user: { id: string },
    @Request() req: any,
  ) {
    return this.appointmentsService.create(
      dto,
      this.resolveFacility(facilityIdHeader, req),
      user.id,
      req.user?.tenantId,
    );
  }

  @Get()
  @AuthWithPermissions('appointments.read')
  @ApiOperation({ summary: 'Get all appointments with filters' })
  findAll(
    @Query() query: AppointmentQueryDto,
    @Headers('x-facility-id') facilityIdHeader: string,
    @Request() req: any,
  ) {
    return this.appointmentsService.findAll(
      query,
      this.resolveFacility(facilityIdHeader, req),
      req.user?.tenantId,
    );
  }

  @Get('stats')
  @AuthWithPermissions('appointments.read')
  @ApiOperation({ summary: 'Get appointment statistics' })
  getStats(
    @Query('date') date: string,
    @Headers('x-facility-id') facilityIdHeader: string,
    @Request() req: any,
  ) {
    return this.appointmentsService.getStats(
      this.resolveFacility(facilityIdHeader, req),
      date,
      req.user?.tenantId,
    );
  }

  @Get(':id')
  @AuthWithPermissions('appointments.read')
  @ApiOperation({ summary: 'Get appointment by ID' })
  findOne(
    @Param('id') id: string,
    @Headers('x-facility-id') facilityIdHeader: string,
    @Request() req: any,
  ) {
    return this.appointmentsService.findOne(
      id,
      this.resolveFacility(facilityIdHeader, req),
      req.user?.tenantId,
    );
  }

  @Put(':id')
  @AuthWithPermissions('appointments.update')
  @ApiOperation({ summary: 'Update an appointment' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @Headers('x-facility-id') facilityIdHeader: string,
    @Request() req: any,
  ) {
    return this.appointmentsService.update(
      id,
      dto,
      this.resolveFacility(facilityIdHeader, req),
      req.user?.tenantId,
    );
  }

  @Patch(':id/status')
  @AuthWithPermissions('appointments.update')
  @ApiOperation({ summary: 'Update appointment status' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateAppointmentStatusDto,
    @Headers('x-facility-id') facilityIdHeader: string,
    @Request() req: any,
  ) {
    return this.appointmentsService.updateStatus(
      id,
      body.status,
      this.resolveFacility(facilityIdHeader, req),
      body.cancellationReason,
      req.user?.tenantId,
      req.user?.id || req.user?.sub,
    );
  }

  @Post(':id/check-in')
  @AuthWithPermissions('appointments.update')
  @ApiOperation({ summary: 'Check in an appointment and create queue entry' })
  checkIn(
    @Param('id') id: string,
    @Headers('x-facility-id') facilityIdHeader: string,
    @CurrentUser() user: { id: string },
    @Request() req: any,
  ) {
    return this.appointmentsService.checkIn(
      id,
      this.resolveFacility(facilityIdHeader, req),
      user.id,
      req.user?.tenantId,
    );
  }

  @Delete(':id')
  @AuthWithPermissions('appointments.delete')
  @ApiOperation({ summary: 'Delete an appointment' })
  delete(
    @Param('id') id: string,
    @Headers('x-facility-id') facilityIdHeader: string,
    @Request() req: any,
  ) {
    return this.appointmentsService.delete(
      id,
      this.resolveFacility(facilityIdHeader, req),
      req.user?.tenantId,
    );
  }
}
