import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  Request,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { IpdService } from './ipd.service';
import { BedBoardService } from './bed-board.service';
import {
  CreateWardDto,
  UpdateWardDto,
  CreateBedDto,
  UpdateBedDto,
  BulkCreateBedsDto,
  CreateAdmissionDto,
  DischargeAdmissionDto,
  TransferBedDto,
  CreateNursingNoteDto,
  ScheduleMedicationDto,
  AdministerMedicationDto,
  WardQueryDto,
  AdmissionQueryDto,
} from './dto/ipd.dto';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireFacilityAccess } from '../auth/decorators/facility-access.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateUuid(id: string, fieldName = 'id'): void {
  if (!UUID_REGEX.test(id)) {
    throw new BadRequestException(`Invalid ${fieldName} format`);
  }
}

@ApiTags('IPD/Ward Management')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('ipd')
@RequireFacilityAccess()
@Controller('ipd')
export class IpdController {
  constructor(
    private readonly ipdService: IpdService,
    private readonly bedBoardService: BedBoardService,
  ) {}

  // ========== BED-BOARD / CENSUS / RESERVATIONS ==========
  @Get('bed-board')
  @AuthWithPermissions('ipd.read')
  @ApiOperation({ summary: 'Real-time wall-board: wards → beds → occupants' })
  bedBoard(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.bedBoardService.getBedBoard(facilityId, req.user?.tenantId);
  }

  @Get('census')
  @AuthWithPermissions('ipd.read')
  @ApiOperation({ summary: 'Census report: occupancy %, ALOS, turnover for a date range' })
  census(
    @Query('facilityId') facilityId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Request() req: any,
  ) {
    if (!facilityId || !dateFrom || !dateTo) {
      throw new BadRequestException('facilityId, dateFrom and dateTo are required');
    }
    return this.bedBoardService.getCensus(facilityId, dateFrom, dateTo, req.user?.tenantId);
  }

  @Post('beds/:id/reserve')
  @AuthWithPermissions('ipd.update')
  @ApiOperation({ summary: 'Reserve a bed (TTL-bounded hold for a planned admission)' })
  reserveBed(
    @Param('id') id: string,
    @Body() body: { holdHours?: number; reason?: string },
    @Request() req: any,
  ) {
    validateUuid(id, 'bed id');
    return this.bedBoardService.reserveBed(
      id,
      body?.holdHours ?? 4,
      body?.reason ?? '',
      req.user?.id,
      req.user?.tenantId,
    );
  }

  @Post('beds/:id/release-reservation')
  @AuthWithPermissions('ipd.update')
  @ApiOperation({ summary: 'Release a bed reservation (back to AVAILABLE)' })
  releaseReservation(@Param('id') id: string, @Request() req: any) {
    validateUuid(id, 'bed id');
    return this.bedBoardService.releaseReservation(id, req.user?.tenantId);
  }

  @Get('admissions/:id/bed-charges-preview')
  @AuthWithPermissions('ipd.read')
  @ApiOperation({ summary: 'Preview bed-day charges for an admission (handles transfers)' })
  previewBedCharges(@Param('id') id: string, @Request() req: any) {
    validateUuid(id, 'admission id');
    return this.bedBoardService.computeBedDayCharges(id, req.user?.tenantId);
  }

  // ========== WARD ENDPOINTS ==========
  @Post('wards')
  @AuthWithPermissions('ipd.create')
  @ApiOperation({ summary: 'Create a new ward' })
  createWard(@Body() dto: CreateWardDto, @Request() req: any) {
    return this.ipdService.createWard(dto, req.user?.tenantId);
  }

  @Get('wards')
  @AuthWithPermissions('ipd.read')
  @ApiOperation({ summary: 'Get all wards' })
  getWards(@Query() query: WardQueryDto, @Request() req: any) {
    return this.ipdService.getWards(query, req.user?.tenantId);
  }

  @Get('wards/occupancy')
  @AuthWithPermissions('ipd.read')
  @ApiOperation({ summary: 'Get ward occupancy summary' })
  getWardOccupancy(@Query('facilityId') facilityId?: string, @Request() req?: any) {
    if (facilityId) validateUuid(facilityId, 'facilityId');
    return this.ipdService.getWardOccupancy(facilityId, req?.user?.tenantId);
  }

  @Get('wards/:id/handover')
  @AuthWithPermissions('ipd.read')
  @ApiOperation({ summary: 'Nurse shift-handover summary for a ward' })
  getWardHandover(@Param('id') id: string, @Request() req: any) {
    validateUuid(id);
    return this.ipdService.getWardHandover(id, req.user?.tenantId);
  }

  @Get('wards/:id')
  @AuthWithPermissions('ipd.read')
  @ApiOperation({ summary: 'Get ward by ID' })
  getWard(@Param('id') id: string, @Request() req: any) {
    validateUuid(id);
    return this.ipdService.getWard(id, req.user?.tenantId);
  }

  @Patch('wards/:id')
  @AuthWithPermissions('ipd.update')
  @ApiOperation({ summary: 'Update a ward' })
  updateWard(@Param('id') id: string, @Body() dto: UpdateWardDto, @Request() req: any) {
    validateUuid(id);
    return this.ipdService.updateWard(id, dto, req.user?.tenantId);
  }

  // ========== BED ENDPOINTS ==========
  @Post('beds')
  @AuthWithPermissions('ipd.create')
  @ApiOperation({ summary: 'Create a new bed' })
  createBed(@Body() dto: CreateBedDto, @Request() req: any) {
    return this.ipdService.createBed(dto, req.user?.tenantId);
  }

  @Post('beds/bulk')
  @AuthWithPermissions('ipd.create')
  @ApiOperation({ summary: 'Bulk create beds for a ward' })
  bulkCreateBeds(@Body() dto: BulkCreateBedsDto, @Request() req: any) {
    return this.ipdService.bulkCreateBeds(dto, req.user?.tenantId);
  }

  @Get('beds')
  @AuthWithPermissions('ipd.read')
  @ApiOperation({ summary: 'Get beds for a ward' })
  getBeds(@Query('wardId') wardId: string, @Request() req: any) {
    if (wardId) validateUuid(wardId, 'wardId');
    return this.ipdService.getBeds(wardId, req.user?.tenantId);
  }

  @Get('beds/available')
  @AuthWithPermissions('ipd.read')
  @ApiOperation({ summary: 'Get available beds' })
  getAvailableBeds(@Query('wardId') wardId?: string, @Request() req?: any) {
    if (wardId) validateUuid(wardId, 'wardId');
    return this.ipdService.getAvailableBeds(wardId, req?.user?.tenantId);
  }

  @Get('beds/:id')
  @AuthWithPermissions('ipd.read')
  @ApiOperation({ summary: 'Get bed by ID' })
  getBed(@Param('id') id: string, @Request() req: any) {
    validateUuid(id);
    return this.ipdService.getBed(id, req.user?.tenantId);
  }

  @Patch('beds/:id')
  @AuthWithPermissions('ipd.update')
  @ApiOperation({ summary: 'Update a bed' })
  updateBed(@Param('id') id: string, @Body() dto: UpdateBedDto, @Request() req: any) {
    validateUuid(id);
    return this.ipdService.updateBed(id, dto, req.user?.tenantId);
  }

  // ========== ADMISSION ENDPOINTS ==========
  @Post('admissions')
  @AuthWithPermissions('ipd.create')
  @ApiOperation({ summary: 'Admit a patient' })
  createAdmission(@Body() dto: CreateAdmissionDto, @Request() req: any) {
    return this.ipdService.createAdmission(dto, req.user.id, req.user?.tenantId);
  }

  @Get('admissions')
  @AuthWithPermissions('ipd.read')
  @ApiOperation({ summary: 'Get admissions' })
  getAdmissions(@Query() query: AdmissionQueryDto, @Request() req: any) {
    return this.ipdService.getAdmissions(query, req.user?.tenantId);
  }

  @Get('discharge-planning')
  @AuthWithPermissions('ipd.read')
  @ApiOperation({ summary: 'Discharge-planning board: overdue / today / upcoming planned discharges' })
  getDischargePlanning(@Query('facilityId') facilityId: string, @Request() req: any) {
    validateUuid(facilityId, 'facilityId');
    return this.ipdService.getDischargePlanning(facilityId, req.user?.tenantId);
  }

  @Patch('admissions/:id/expected-discharge')
  @AuthWithPermissions('ipd.update')
  @ApiOperation({ summary: 'Set or clear the planned discharge date for an admission' })
  setExpectedDischarge(
    @Param('id') id: string,
    @Body() body: { expectedDischargeDate: string | null },
    @Request() req: any,
  ) {
    validateUuid(id);
    return this.ipdService.setExpectedDischargeDate(
      id,
      body?.expectedDischargeDate ?? null,
      req.user?.tenantId,
    );
  }

  @Get('admissions/:id')
  @AuthWithPermissions('ipd.read')
  @ApiOperation({ summary: 'Get admission by ID' })
  getAdmission(@Param('id') id: string, @Request() req: any) {
    validateUuid(id);
    return this.ipdService.getAdmission(id, req.user?.tenantId);
  }

  @Get('patients/:patientId/current-admission')
  @AuthWithPermissions('ipd.read')
  @ApiOperation({ summary: 'Get current admission for a patient' })
  getCurrentAdmission(@Param('patientId') patientId: string, @Request() req: any) {
    validateUuid(patientId, 'patientId');
    return this.ipdService.getCurrentAdmission(patientId, req.user?.tenantId);
  }

  @Post('admissions/:id/discharge')
  @AuthWithPermissions('ipd.discharge')
  @ApiOperation({ summary: 'Discharge a patient' })
  dischargePatient(
    @Param('id') id: string,
    @Body() dto: DischargeAdmissionDto,
    @Request() req: any,
  ) {
    validateUuid(id);
    return this.ipdService.dischargePatient(id, dto, req.user.id, req.user?.tenantId);
  }

  @Post('admissions/:id/transfer')
  @AuthWithPermissions('ipd.transfer')
  @ApiOperation({ summary: 'Transfer patient to another bed' })
  transferBed(@Param('id') id: string, @Body() dto: TransferBedDto, @Request() req: any) {
    validateUuid(id);
    return this.ipdService.transferBed(id, dto, req.user.id, req.user?.tenantId);
  }

  // ========== NURSING NOTES ==========
  @Post('nursing-notes')
  @AuthWithPermissions('ipd.create')
  @ApiOperation({ summary: 'Create a nursing note' })
  createNursingNote(@Body() dto: CreateNursingNoteDto, @Request() req: any) {
    return this.ipdService.createNursingNote(dto, req.user.id, req.user?.tenantId);
  }

  @Get('admissions/:id/nursing-notes')
  @AuthWithPermissions('ipd.read')
  @ApiOperation({ summary: 'Get nursing notes for an admission' })
  getNursingNotes(@Param('id') admissionId: string, @Request() req: any) {
    validateUuid(admissionId);
    return this.ipdService.getNursingNotes(admissionId, req.user?.tenantId);
  }

  // ========== MEDICATION ADMINISTRATION ==========
  @Post('medications')
  @AuthWithPermissions('ipd.create')
  @ApiOperation({ summary: 'Schedule medication administration' })
  scheduleMedication(@Body() dto: ScheduleMedicationDto, @Request() req: any) {
    return this.ipdService.scheduleMedication(dto, req.user.id, req.user?.tenantId);
  }

  @Get('admissions/:id/medications')
  @AuthWithPermissions('ipd.read')
  @ApiOperation({ summary: 'Get medication schedule for an admission' })
  getMedicationSchedule(
    @Param('id') admissionId: string,
    @Query('date') date?: string,
    @Request() req?: any,
  ) {
    validateUuid(admissionId);
    return this.ipdService.getMedicationSchedule(admissionId, date, req?.user?.tenantId);
  }

  @Put('medications/:id/administer')
  @AuthWithPermissions('ipd.update')
  @ApiOperation({ summary: 'Record medication administration' })
  administerMedication(
    @Param('id') id: string,
    @Body() dto: AdministerMedicationDto,
    @Request() req: any,
  ) {
    validateUuid(id);
    return this.ipdService.administerMedication(id, dto, req.user.id, req.user?.tenantId);
  }

  // ========== DASHBOARD ==========
  @Get('stats')
  @AuthWithPermissions('ipd.read')
  @ApiOperation({ summary: 'Get IPD statistics' })
  getIpdStats(@Query('facilityId') facilityId?: string, @Request() req?: any) {
    if (facilityId) validateUuid(facilityId, 'facilityId');
    return this.ipdService.getIpdStats(facilityId, req?.user?.tenantId);
  }
}
