import { Controller, Get, Post, Put, Patch, Body, Param, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { IpdService } from './ipd.service';
import {
  CreateWardDto, UpdateWardDto, CreateBedDto, UpdateBedDto, BulkCreateBedsDto,
  CreateAdmissionDto, DischargeAdmissionDto, TransferBedDto,
  CreateNursingNoteDto, ScheduleMedicationDto, AdministerMedicationDto,
  WardQueryDto, AdmissionQueryDto,
} from './dto/ipd.dto';

@ApiTags('IPD/Ward Management')
@ApiBearerAuth()
@Controller('ipd')
export class IpdController {
  constructor(private readonly ipdService: IpdService) {}

  // ========== WARD ENDPOINTS ==========
  @Post('wards')
  @Auth()
  @ApiOperation({ summary: 'Create a new ward' })
  createWard(@Body() dto: CreateWardDto) {
    return this.ipdService.createWard(dto);
  }

  @Get('wards')
  @Auth()
  @ApiOperation({ summary: 'Get all wards' })
  getWards(@Query() query: WardQueryDto) {
    return this.ipdService.getWards(query);
  }

  @Get('wards/occupancy')
  @Auth()
  @ApiOperation({ summary: 'Get ward occupancy summary' })
  getWardOccupancy(@Query('facilityId') facilityId?: string) {
    return this.ipdService.getWardOccupancy(facilityId);
  }

  @Get('wards/:id')
  @Auth()
  @ApiOperation({ summary: 'Get ward by ID' })
  getWard(@Param('id') id: string) {
    return this.ipdService.getWard(id);
  }

  @Patch('wards/:id')
  @Auth()
  @ApiOperation({ summary: 'Update a ward' })
  updateWard(@Param('id') id: string, @Body() dto: UpdateWardDto) {
    return this.ipdService.updateWard(id, dto);
  }

  // ========== BED ENDPOINTS ==========
  @Post('beds')
  @Auth()
  @ApiOperation({ summary: 'Create a new bed' })
  createBed(@Body() dto: CreateBedDto) {
    return this.ipdService.createBed(dto);
  }

  @Post('beds/bulk')
  @Auth()
  @ApiOperation({ summary: 'Bulk create beds for a ward' })
  bulkCreateBeds(@Body() dto: BulkCreateBedsDto) {
    return this.ipdService.bulkCreateBeds(dto);
  }

  @Get('beds')
  @Auth()
  @ApiOperation({ summary: 'Get beds for a ward' })
  getBeds(@Query('wardId') wardId: string) {
    return this.ipdService.getBeds(wardId);
  }

  @Get('beds/available')
  @Auth()
  @ApiOperation({ summary: 'Get available beds' })
  getAvailableBeds(@Query('wardId') wardId?: string) {
    return this.ipdService.getAvailableBeds(wardId);
  }

  @Get('beds/:id')
  @Auth()
  @ApiOperation({ summary: 'Get bed by ID' })
  getBed(@Param('id') id: string) {
    return this.ipdService.getBed(id);
  }

  @Patch('beds/:id')
  @Auth()
  @ApiOperation({ summary: 'Update a bed' })
  updateBed(@Param('id') id: string, @Body() dto: UpdateBedDto) {
    return this.ipdService.updateBed(id, dto);
  }

  // ========== ADMISSION ENDPOINTS ==========
  @Post('admissions')
  @Auth()
  @ApiOperation({ summary: 'Admit a patient' })
  createAdmission(@Body() dto: CreateAdmissionDto, @Request() req: any) {
    return this.ipdService.createAdmission(dto, req.user.id);
  }

  @Get('admissions')
  @Auth()
  @ApiOperation({ summary: 'Get admissions' })
  getAdmissions(@Query() query: AdmissionQueryDto) {
    return this.ipdService.getAdmissions(query);
  }

  @Get('admissions/:id')
  @Auth()
  @ApiOperation({ summary: 'Get admission by ID' })
  getAdmission(@Param('id') id: string) {
    return this.ipdService.getAdmission(id);
  }

  @Get('patients/:patientId/current-admission')
  @Auth()
  @ApiOperation({ summary: 'Get current admission for a patient' })
  getCurrentAdmission(@Param('patientId') patientId: string) {
    return this.ipdService.getCurrentAdmission(patientId);
  }

  @Post('admissions/:id/discharge')
  @Auth()
  @ApiOperation({ summary: 'Discharge a patient' })
  dischargePatient(@Param('id') id: string, @Body() dto: DischargeAdmissionDto, @Request() req: any) {
    return this.ipdService.dischargePatient(id, dto, req.user.id);
  }

  @Post('admissions/:id/transfer')
  @Auth()
  @ApiOperation({ summary: 'Transfer patient to another bed' })
  transferBed(@Param('id') id: string, @Body() dto: TransferBedDto, @Request() req: any) {
    return this.ipdService.transferBed(id, dto, req.user.id);
  }

  // ========== NURSING NOTES ==========
  @Post('nursing-notes')
  @Auth()
  @ApiOperation({ summary: 'Create a nursing note' })
  createNursingNote(@Body() dto: CreateNursingNoteDto, @Request() req: any) {
    return this.ipdService.createNursingNote(dto, req.user.id);
  }

  @Get('admissions/:id/nursing-notes')
  @Auth()
  @ApiOperation({ summary: 'Get nursing notes for an admission' })
  getNursingNotes(@Param('id') admissionId: string) {
    return this.ipdService.getNursingNotes(admissionId);
  }

  // ========== MEDICATION ADMINISTRATION ==========
  @Post('medications')
  @Auth()
  @ApiOperation({ summary: 'Schedule medication administration' })
  scheduleMedication(@Body() dto: ScheduleMedicationDto, @Request() req: any) {
    return this.ipdService.scheduleMedication(dto, req.user.id);
  }

  @Get('admissions/:id/medications')
  @Auth()
  @ApiOperation({ summary: 'Get medication schedule for an admission' })
  getMedicationSchedule(@Param('id') admissionId: string, @Query('date') date?: string) {
    return this.ipdService.getMedicationSchedule(admissionId, date);
  }

  @Put('medications/:id/administer')
  @Auth()
  @ApiOperation({ summary: 'Record medication administration' })
  administerMedication(@Param('id') id: string, @Body() dto: AdministerMedicationDto, @Request() req: any) {
    return this.ipdService.administerMedication(id, dto, req.user.id);
  }

  // ========== DASHBOARD ==========
  @Get('stats')
  @Auth()
  @ApiOperation({ summary: 'Get IPD statistics' })
  getIpdStats(@Query('facilityId') facilityId?: string) {
    return this.ipdService.getIpdStats(facilityId);
  }
}
