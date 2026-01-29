import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { MaternityService } from './maternity.service';
import {
  RegisterAntenatalDto,
  RecordAntenatalVisitDto,
  AdmitLabourDto,
  UpdateLabourProgressDto,
  RecordDeliveryDto,
  RecordBabyOutcomeDto,
  RecordPostnatalVisitDto,
  RecordBabyWellnessDto,
  AdministerVaccineDto,
} from './dto/maternity.dto';
import { PregnancyStatus } from '../../database/entities/antenatal-registration.entity';

@ApiTags('Maternity / Antenatal')
@ApiBearerAuth()
@Controller('maternity')
export class MaternityController {
  constructor(private readonly maternityService: MaternityService) {}

  // ============ ANC REGISTRATION ============

  @Post('anc/register')
  @AuthWithPermissions('maternity.create')
  @ApiOperation({ summary: 'Register new antenatal case' })
  registerAntenatal(@Body() dto: RegisterAntenatalDto, @Request() req: any) {
    return this.maternityService.registerAntenatal(dto, req.user.id);
  }

  @Get('anc/registrations')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get ANC registrations' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'status', required: false, enum: PregnancyStatus })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  getRegistrations(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: PregnancyStatus,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.maternityService.getRegistrations(facilityId, { status, limit, offset });
  }

  @Get('anc/registrations/:id')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get ANC registration by ID' })
  getRegistration(@Param('id', ParseUUIDPipe) id: string) {
    return this.maternityService.getRegistrationById(id);
  }

  @Get('anc/due-soon')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get patients due within X weeks' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'weeks', required: false, description: 'Weeks ahead, default 4' })
  getDueSoon(
    @Query('facilityId') facilityId: string,
    @Query('weeks') weeks?: number,
  ) {
    return this.maternityService.getDueSoon(facilityId, weeks || 4);
  }

  // ============ ANTENATAL VISITS ============

  @Post('anc/visits')
  @AuthWithPermissions('maternity.create')
  @ApiOperation({ summary: 'Record ANC visit' })
  recordVisit(@Body() dto: RecordAntenatalVisitDto, @Request() req: any) {
    return this.maternityService.recordVisit(dto, req.user.id);
  }

  @Get('anc/registrations/:id/visits')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get all visits for a registration' })
  getVisits(@Param('id', ParseUUIDPipe) id: string) {
    return this.maternityService.getVisits(id);
  }

  // ============ LABOUR & DELIVERY ============

  @Post('labour/admit')
  @AuthWithPermissions('maternity.create')
  @ApiOperation({ summary: 'Admit patient for labour' })
  admitLabour(@Body() dto: AdmitLabourDto, @Request() req: any) {
    return this.maternityService.admitLabour(dto, req.user.id);
  }

  @Get('labour/:id')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get labour record by ID' })
  getLabour(@Param('id', ParseUUIDPipe) id: string) {
    return this.maternityService.getLabourById(id);
  }

  @Put('labour/:id/progress')
  @AuthWithPermissions('maternity.update')
  @ApiOperation({ summary: 'Update labour progress' })
  updateProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLabourProgressDto,
  ) {
    return this.maternityService.updateLabourProgress(id, dto);
  }

  @Put('labour/:id/delivery')
  @AuthWithPermissions('maternity.update')
  @ApiOperation({ summary: 'Record delivery' })
  recordDelivery(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordDeliveryDto,
    @Request() req: any,
  ) {
    return this.maternityService.recordDelivery(id, dto, req.user.id);
  }

  @Post('labour/baby-outcome')
  @AuthWithPermissions('maternity.create')
  @ApiOperation({ summary: 'Record baby outcome' })
  recordBabyOutcome(@Body() dto: RecordBabyOutcomeDto) {
    return this.maternityService.recordBabyOutcome(dto);
  }

  @Get('labour/:id/outcomes')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get baby outcomes for a labour' })
  getBabyOutcomes(@Param('id', ParseUUIDPipe) id: string) {
    return this.maternityService.getBabyOutcomes(id);
  }

  @Get('labour/active')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get active labours' })
  @ApiQuery({ name: 'facilityId', required: true })
  getActiveLabours(@Query('facilityId') facilityId: string) {
    return this.maternityService.getActiveLabours(facilityId);
  }

  // ============ DASHBOARD ============

  @Get('dashboard')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get maternity dashboard stats' })
  @ApiQuery({ name: 'facilityId', required: true })
  getDashboard(@Query('facilityId') facilityId: string) {
    return this.maternityService.getDashboard(facilityId);
  }

  // ============ POSTNATAL CARE (PNC) ============

  @Post('pnc/visits')
  @AuthWithPermissions('maternity.create')
  @ApiOperation({ summary: 'Record postnatal visit' })
  recordPostnatalVisit(@Body() dto: RecordPostnatalVisitDto, @Request() req: any) {
    return this.maternityService.recordPostnatalVisit(dto, req.user.id);
  }

  @Get('pnc/visits')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get PNC visits for a registration' })
  @ApiQuery({ name: 'registrationId', required: true })
  getPostnatalVisits(@Query('registrationId') registrationId: string) {
    return this.maternityService.getPostnatalVisits(registrationId);
  }

  @Get('pnc/visits/:id')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get PNC visit by ID' })
  getPostnatalVisit(@Param('id', ParseUUIDPipe) id: string) {
    return this.maternityService.getPostnatalVisitById(id);
  }

  @Get('pnc/due-list')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get PNC due list' })
  @ApiQuery({ name: 'facilityId', required: true })
  getPNCDueList(@Query('facilityId') facilityId: string) {
    return this.maternityService.getPNCDueList(facilityId);
  }

  // ============ BABY WELLNESS ============

  @Post('baby/wellness')
  @AuthWithPermissions('maternity.create')
  @ApiOperation({ summary: 'Record baby wellness check' })
  recordBabyWellness(@Body() dto: RecordBabyWellnessDto, @Request() req: any) {
    return this.maternityService.recordBabyWellness(dto, req.user.id);
  }

  @Get('baby/:deliveryOutcomeId/wellness')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get baby wellness checks' })
  getBabyWellnessChecks(@Param('deliveryOutcomeId', ParseUUIDPipe) deliveryOutcomeId: string) {
    return this.maternityService.getBabyWellnessChecks(deliveryOutcomeId);
  }

  // ============ IMMUNIZATION ============

  @Post('immunization/generate/:deliveryOutcomeId')
  @AuthWithPermissions('maternity.create')
  @ApiOperation({ summary: 'Generate immunization schedule for a newborn' })
  @ApiQuery({ name: 'facilityId', required: true })
  generateImmunizationSchedule(
    @Param('deliveryOutcomeId', ParseUUIDPipe) deliveryOutcomeId: string,
    @Query('facilityId') facilityId: string,
  ) {
    return this.maternityService.generateImmunizationSchedule(deliveryOutcomeId, facilityId);
  }

  @Get('immunization/schedule/:deliveryOutcomeId')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get immunization schedule for a child' })
  getImmunizationSchedule(@Param('deliveryOutcomeId', ParseUUIDPipe) deliveryOutcomeId: string) {
    return this.maternityService.getImmunizationSchedule(deliveryOutcomeId);
  }

  @Put('immunization/:id/administer')
  @AuthWithPermissions('maternity.update')
  @ApiOperation({ summary: 'Administer a vaccine' })
  administerVaccine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdministerVaccineDto,
    @Request() req: any,
  ) {
    return this.maternityService.administerVaccine(id, dto, req.user.id);
  }

  @Get('immunization/due')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get due immunizations' })
  @ApiQuery({ name: 'facilityId', required: true })
  getImmunizationsDue(@Query('facilityId') facilityId: string) {
    return this.maternityService.getImmunizationsDue(facilityId);
  }

  @Get('immunization/defaulters')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get immunization defaulters' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'daysOverdue', required: false })
  getImmunizationDefaulters(
    @Query('facilityId') facilityId: string,
    @Query('daysOverdue') daysOverdue?: number,
  ) {
    return this.maternityService.getImmunizationDefaulters(facilityId, daysOverdue || 14);
  }
}
