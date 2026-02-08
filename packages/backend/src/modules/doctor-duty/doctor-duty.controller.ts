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
    return this.doctorDutyService.checkIn(dto, req.user.sub, facilityId);
  }

  @Post(':id/check-out')
  @AuthWithPermissions('doctor-duty.update')
  async checkOut(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CheckOutDto) {
    return this.doctorDutyService.checkOut(id, dto.notes);
  }

  @Patch(':id/status')
  @AuthWithPermissions('doctor-duty.update')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: DutyStatus,
  ) {
    return this.doctorDutyService.updateStatus(id, status);
  }

  @Get('on-duty')
  @AuthWithPermissions('doctor-duty.read')
  async getDoctorsOnDuty(@Query() filter: DoctorDutyFilterDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.doctorDutyService.getDoctorsOnDuty(facilityId, filter);
  }

  @Get('all-doctors')
  @AuthWithPermissions('doctor-duty.read')
  async getAllDoctors(@Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.doctorDutyService.getAllDoctors(facilityId);
  }

  @Get('with-status')
  @AuthWithPermissions('doctor-duty.read')
  async getDoctorsWithStatus(@Query('date') date: string, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.doctorDutyService.getDoctorsWithDutyStatus(facilityId, date);
  }

  @Post()
  @AuthWithPermissions('doctor-duty.create')
  async create(@Body() dto: CreateDoctorDutyDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.doctorDutyService.create(dto, req.user.sub, facilityId);
  }

  @Get(':id')
  @AuthWithPermissions('doctor-duty.read')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.doctorDutyService.findOne(id);
  }

  @Patch(':id')
  @AuthWithPermissions('doctor-duty.update')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDoctorDutyDto) {
    return this.doctorDutyService.update(id, dto);
  }
}
