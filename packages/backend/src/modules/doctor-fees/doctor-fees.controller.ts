import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Request,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { DoctorFeesService } from './doctor-fees.service';
import { UpsertDoctorFeeProfileDto } from './doctor-fees.dto';

@ApiTags('Doctor Fees')
@Controller('doctor-fees')
export class DoctorFeesController {
  constructor(private readonly service: DoctorFeesService) {}

  @Get('profiles')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'List all doctor fee profiles' })
  list(@Request() req: any) {
    return this.service.listProfiles(req.user?.tenantId);
  }

  @Get('profiles/:doctorId')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'Get a single doctor fee profile' })
  get(@Param('doctorId', ParseUUIDPipe) doctorId: string, @Request() req: any) {
    return this.service.getProfile(doctorId, req.user?.tenantId);
  }

  @Put('profiles/:doctorId')
  @AuthWithPermissions('billing.update')
  @ApiOperation({ summary: 'Create or update a doctor fee profile' })
  upsert(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: UpsertDoctorFeeProfileDto,
    @Request() req: any,
  ) {
    return this.service.upsertProfile(doctorId, dto, req.user?.tenantId);
  }

  @Delete('profiles/:doctorId')
  @AuthWithPermissions('billing.update')
  @ApiOperation({ summary: 'Soft-delete a doctor fee profile (revert to specialty/default)' })
  remove(@Param('doctorId', ParseUUIDPipe) doctorId: string, @Request() req: any) {
    return this.service.deleteProfile(doctorId, req.user?.tenantId);
  }

  @Get('preview')
  @AuthWithPermissions('billing.read')
  @ApiOperation({
    summary: 'Preview the resolved consultation fee for a given doctor/department/patient',
  })
  preview(
    @Query('doctorId') doctorId: string | undefined,
    @Query('departmentId') departmentId: string | undefined,
    @Query('facilityId') facilityId: string,
    @Query('patientId') patientId: string | undefined,
    @Request() req: any,
  ) {
    return this.service.resolve({
      doctorId,
      departmentId,
      facilityId,
      patientId,
      tenantId: req.user?.tenantId,
    });
  }
}
