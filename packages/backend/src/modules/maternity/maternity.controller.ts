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
  UseGuards,
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
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@ApiTags('Maternity / Antenatal')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('maternity')
@Controller('maternity')
export class MaternityController {
  constructor(private readonly maternityService: MaternityService) {}

  // ============ ANC REGISTRATION ============

  @Post('anc/register')
  @AuthWithPermissions('maternity.create')
  @ApiOperation({ summary: 'Register new antenatal case' })
  registerAntenatal(@Body() dto: RegisterAntenatalDto, @Request() req: any) {
    return this.maternityService.registerAntenatal(dto, req.user.id, req.user?.tenantId);
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
    @Request() req?: any,
  ) {
    return this.maternityService.getRegistrations(
      facilityId,
      { status, limit, offset },
      req?.user?.tenantId,
    );
  }

  @Get('anc/registrations/:id')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get ANC registration by ID' })
  getRegistration(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.maternityService.getRegistrationById(id, req.user?.tenantId);
  }

  @Get('anc/due-soon')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get patients due within X weeks' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'weeks', required: false, description: 'Weeks ahead, default 4' })
  getDueSoon(
    @Query('facilityId') facilityId: string,
    @Query('weeks') weeks?: number,
    @Request() req?: any,
  ) {
    return this.maternityService.getDueSoon(facilityId, weeks || 4, req?.user?.tenantId);
  }

  // ============ ANTENATAL VISITS ============

  @Post('anc/visits')
  @AuthWithPermissions('maternity.create')
  @ApiOperation({ summary: 'Record ANC visit' })
  recordVisit(@Body() dto: RecordAntenatalVisitDto, @Request() req: any) {
    return this.maternityService.recordVisit(dto, req.user.id, req.user?.tenantId);
  }

  @Get('anc/registrations/:id/visits')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get all visits for a registration' })
  getVisits(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.maternityService.getVisits(id, req.user?.tenantId);
  }

  // ============ LABOUR & DELIVERY ============

  @Post('labour/admit')
  @AuthWithPermissions('maternity.create')
  @ApiOperation({ summary: 'Admit patient for labour' })
  admitLabour(@Body() dto: AdmitLabourDto, @Request() req: any) {
    return this.maternityService.admitLabour(dto, req.user.id, req.user?.tenantId);
  }

  @Get('labour/:id')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get labour record by ID' })
  getLabour(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.maternityService.getLabourById(id, req.user?.tenantId);
  }

  @Put('labour/:id/progress')
  @AuthWithPermissions('maternity.update')
  @ApiOperation({ summary: 'Update labour progress' })
  updateProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLabourProgressDto,
    @Request() req: any,
  ) {
    return this.maternityService.updateLabourProgress(id, dto, req.user?.tenantId);
  }

  @Put('labour/:id/delivery')
  @AuthWithPermissions('maternity.update')
  @ApiOperation({ summary: 'Record delivery' })
  recordDelivery(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordDeliveryDto,
    @Request() req: any,
  ) {
    return this.maternityService.recordDelivery(id, dto, req.user.id, req.user?.tenantId);
  }

  @Post('labour/baby-outcome')
  @AuthWithPermissions('maternity.create')
  @ApiOperation({ summary: 'Record baby outcome' })
  recordBabyOutcome(@Body() dto: RecordBabyOutcomeDto, @Request() req: any) {
    return this.maternityService.recordBabyOutcome(dto, req.user?.tenantId);
  }

  @Get('labour/:id/outcomes')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get baby outcomes for a labour' })
  getBabyOutcomes(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.maternityService.getBabyOutcomes(id, req.user?.tenantId);
  }

  @Get('labour/active')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get active labours' })
  @ApiQuery({ name: 'facilityId', required: true })
  getActiveLabours(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.maternityService.getActiveLabours(facilityId, req.user?.tenantId);
  }

  // ============ DASHBOARD ============

  @Get('dashboard')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get maternity dashboard stats' })
  @ApiQuery({ name: 'facilityId', required: true })
  getDashboard(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.maternityService.getDashboard(facilityId, req.user?.tenantId);
  }

  // ============ POSTNATAL CARE (PNC) ============

  @Post('pnc/visits')
  @AuthWithPermissions('maternity.create')
  @ApiOperation({ summary: 'Record postnatal visit' })
  recordPostnatalVisit(@Body() dto: RecordPostnatalVisitDto, @Request() req: any) {
    return this.maternityService.recordPostnatalVisit(dto, req.user.id, req.user?.tenantId);
  }

  @Get('pnc/visits')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get PNC visits for a registration' })
  @ApiQuery({ name: 'registrationId', required: true })
  getPostnatalVisits(@Query('registrationId') registrationId: string, @Request() req: any) {
    return this.maternityService.getPostnatalVisits(registrationId, req.user?.tenantId);
  }

  @Get('pnc/visits/:id')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get PNC visit by ID' })
  getPostnatalVisit(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.maternityService.getPostnatalVisitById(id, req.user?.tenantId);
  }

  @Get('pnc/due-list')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get PNC due list' })
  @ApiQuery({ name: 'facilityId', required: true })
  getPNCDueList(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.maternityService.getPNCDueList(facilityId, req.user?.tenantId);
  }

  // ============ BABY WELLNESS ============

  @Post('baby/wellness')
  @AuthWithPermissions('maternity.create')
  @ApiOperation({ summary: 'Record baby wellness check' })
  recordBabyWellness(@Body() dto: RecordBabyWellnessDto, @Request() req: any) {
    return this.maternityService.recordBabyWellness(dto, req.user.id, req.user?.tenantId);
  }

  @Get('baby/:deliveryOutcomeId/wellness')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get baby wellness checks' })
  getBabyWellnessChecks(
    @Param('deliveryOutcomeId', ParseUUIDPipe) deliveryOutcomeId: string,
    @Request() req: any,
  ) {
    return this.maternityService.getBabyWellnessChecks(deliveryOutcomeId, req.user?.tenantId);
  }

  // ============ IMMUNIZATION ============

  @Post('immunization/generate/:deliveryOutcomeId')
  @AuthWithPermissions('maternity.create')
  @ApiOperation({ summary: 'Generate immunization schedule for a newborn' })
  @ApiQuery({ name: 'facilityId', required: true })
  generateImmunizationSchedule(
    @Param('deliveryOutcomeId', ParseUUIDPipe) deliveryOutcomeId: string,
    @Query('facilityId') facilityId: string,
    @Request() req: any,
  ) {
    return this.maternityService.generateImmunizationSchedule(
      deliveryOutcomeId,
      facilityId,
      req.user?.tenantId,
    );
  }

  @Get('immunization/schedule/:deliveryOutcomeId')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get immunization schedule for a child' })
  getImmunizationSchedule(
    @Param('deliveryOutcomeId', ParseUUIDPipe) deliveryOutcomeId: string,
    @Request() req: any,
  ) {
    return this.maternityService.getImmunizationSchedule(deliveryOutcomeId, req.user?.tenantId);
  }

  @Put('immunization/:id/administer')
  @AuthWithPermissions('maternity.update')
  @ApiOperation({ summary: 'Administer a vaccine' })
  administerVaccine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdministerVaccineDto,
    @Request() req: any,
  ) {
    return this.maternityService.administerVaccine(id, dto, req.user.id, req.user?.tenantId);
  }

  @Get('immunization/due')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get due immunizations' })
  @ApiQuery({ name: 'facilityId', required: true })
  getImmunizationsDue(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.maternityService.getImmunizationsDue(facilityId, req.user?.tenantId);
  }

  @Get('immunization/defaulters')
  @AuthWithPermissions('maternity.read')
  @ApiOperation({ summary: 'Get immunization defaulters' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'daysOverdue', required: false })
  getImmunizationDefaulters(
    @Query('facilityId') facilityId: string,
    @Query('daysOverdue') daysOverdue?: number,
    @Request() req?: any,
  ) {
    return this.maternityService.getImmunizationDefaulters(
      facilityId,
      daysOverdue || 14,
      req?.user?.tenantId,
    );
  }
}
