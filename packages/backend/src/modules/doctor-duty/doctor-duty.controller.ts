import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { DoctorDutyService } from './doctor-duty.service';
import {
  CreateDoctorDutyDto,
  UpdateDoctorDutyDto,
  CheckInDto,
  CheckOutDto,
  DoctorDutyFilterDto,
} from './dto/doctor-duty.dto';
import { DutyStatus } from '../../database/entities/doctor-duty.entity';

@Controller('doctor-duty')
@UseGuards(AuthGuard('jwt'))
export class DoctorDutyController {
  constructor(private readonly doctorDutyService: DoctorDutyService) {}

  @Post('check-in')
  @AuthWithPermissions('doctor-duty.create')
  async checkIn(@Body() dto: CheckInDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.doctorDutyService.checkIn(dto, req.user.sub, facilityId, req.user?.tenantId);
  }

  @Post(':id/check-out')
  @AuthWithPermissions('doctor-duty.update')
  async checkOut(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CheckOutDto, @Request() req: any) {
    return this.doctorDutyService.checkOut(id, dto.notes, req.user?.tenantId);
  }

  @Patch(':id/status')
  @AuthWithPermissions('doctor-duty.update')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: DutyStatus,
    @Request() req: any,
  ) {
    return this.doctorDutyService.updateStatus(id, status, req.user?.tenantId);
  }

  @Get('on-duty')
  @AuthWithPermissions('doctor-duty.read')
  async getDoctorsOnDuty(@Query() filter: DoctorDutyFilterDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.doctorDutyService.getDoctorsOnDuty(facilityId, filter, req.user?.tenantId);
  }

  @Get('all-doctors')
  @AuthWithPermissions('doctor-duty.read')
  async getAllDoctors(@Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.doctorDutyService.getAllDoctors(facilityId, req.user?.tenantId);
  }

  @Get('with-status')
  @AuthWithPermissions('doctor-duty.read')
  async getDoctorsWithStatus(@Query('date') date: string, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.doctorDutyService.getDoctorsWithDutyStatus(facilityId, date, req.user?.tenantId);
  }

  @Post()
  @AuthWithPermissions('doctor-duty.create')
  async create(@Body() dto: CreateDoctorDutyDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.doctorDutyService.create(dto, req.user.sub, facilityId, req.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('doctor-duty.read')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.doctorDutyService.findOne(id, req.user?.tenantId);
  }

  @Patch(':id')
  @AuthWithPermissions('doctor-duty.update')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDoctorDutyDto, @Request() req: any) {
    return this.doctorDutyService.update(id, dto, req.user?.tenantId);
  }
}
