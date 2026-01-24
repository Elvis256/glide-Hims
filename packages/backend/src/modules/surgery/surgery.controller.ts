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
import { Auth } from '../auth/decorators/auth.decorator';
import { SurgeryService } from './surgery.service';
import {
  ScheduleSurgeryDto,
  PreOpChecklistDto,
  StartSurgeryDto,
  IntraOpNotesDto,
  CompleteSurgeryDto,
  CancelSurgeryDto,
  CreateTheatreDto,
  UpdateTheatreStatusDto,
} from './dto/surgery.dto';
import { SurgeryStatus } from '../../database/entities/surgery-case.entity';

@ApiTags('Surgery / Theatre')
@ApiBearerAuth()
@Controller('surgery')
export class SurgeryController {
  constructor(private readonly surgeryService: SurgeryService) {}

  // ============ THEATRE ENDPOINTS ============

  @Post('theatres')
  @Auth()
  @ApiOperation({ summary: 'Create a new theatre' })
  createTheatre(@Body() dto: CreateTheatreDto) {
    return this.surgeryService.createTheatre(dto);
  }

  @Get('theatres')
  @Auth()
  @ApiOperation({ summary: 'Get all theatres for a facility' })
  @ApiQuery({ name: 'facilityId', required: true })
  getTheatres(@Query('facilityId') facilityId: string) {
    return this.surgeryService.getTheatres(facilityId);
  }

  @Get('theatres/:id')
  @Auth()
  @ApiOperation({ summary: 'Get theatre by ID' })
  getTheatre(@Param('id', ParseUUIDPipe) id: string) {
    return this.surgeryService.getTheatreById(id);
  }

  @Put('theatres/:id/status')
  @Auth()
  @ApiOperation({ summary: 'Update theatre status' })
  updateTheatreStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTheatreStatusDto,
  ) {
    return this.surgeryService.updateTheatreStatus(id, dto);
  }

  // ============ SURGERY SCHEDULING ============

  @Post('cases')
  @Auth()
  @ApiOperation({ summary: 'Schedule a new surgery' })
  scheduleSurgery(@Body() dto: ScheduleSurgeryDto, @Request() req: any) {
    return this.surgeryService.scheduleSurgery(dto, req.user.id);
  }

  @Get('cases')
  @Auth()
  @ApiOperation({ summary: 'Get surgery cases' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'status', required: false, enum: SurgeryStatus })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  getCases(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: SurgeryStatus,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.surgeryService.getCases(facilityId, { status, limit, offset });
  }

  @Get('cases/:id')
  @Auth()
  @ApiOperation({ summary: 'Get surgery case by ID' })
  getCase(@Param('id', ParseUUIDPipe) id: string) {
    return this.surgeryService.getCaseById(id);
  }

  // ============ SURGERY WORKFLOW ============

  @Put('cases/:id/pre-op')
  @Auth()
  @ApiOperation({ summary: 'Update pre-operative checklist' })
  updatePreOp(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PreOpChecklistDto,
  ) {
    return this.surgeryService.updatePreOpChecklist(id, dto);
  }

  @Put('cases/:id/start')
  @Auth()
  @ApiOperation({ summary: 'Start surgery' })
  startSurgery(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartSurgeryDto,
  ) {
    return this.surgeryService.startSurgery(id, dto);
  }

  @Put('cases/:id/intra-op')
  @Auth()
  @ApiOperation({ summary: 'Update intra-operative notes' })
  updateIntraOp(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IntraOpNotesDto,
  ) {
    return this.surgeryService.updateIntraOpNotes(id, dto);
  }

  @Put('cases/:id/complete')
  @Auth()
  @ApiOperation({ summary: 'Complete surgery and move to post-op' })
  completeSurgery(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteSurgeryDto,
  ) {
    return this.surgeryService.completeSurgery(id, dto);
  }

  @Put('cases/:id/discharge-recovery')
  @Auth()
  @ApiOperation({ summary: 'Discharge patient from recovery' })
  dischargeFromRecovery(@Param('id', ParseUUIDPipe) id: string) {
    return this.surgeryService.dischargeFromRecovery(id);
  }

  @Put('cases/:id/cancel')
  @Auth()
  @ApiOperation({ summary: 'Cancel or postpone surgery' })
  cancelSurgery(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSurgeryDto,
  ) {
    return this.surgeryService.cancelSurgery(id, dto);
  }

  // ============ SCHEDULE & DASHBOARD ============

  @Get('dashboard')
  @Auth()
  @ApiOperation({ summary: 'Get surgery dashboard stats' })
  @ApiQuery({ name: 'facilityId', required: true })
  getDashboard(@Query('facilityId') facilityId: string) {
    return this.surgeryService.getDashboard(facilityId);
  }

  @Get('schedule/today')
  @Auth()
  @ApiOperation({ summary: 'Get today\'s surgery schedule' })
  @ApiQuery({ name: 'facilityId', required: true })
  getTodaySchedule(@Query('facilityId') facilityId: string) {
    return this.surgeryService.getTodaySchedule(facilityId);
  }

  @Get('schedule/date')
  @Auth()
  @ApiOperation({ summary: 'Get surgery schedule for a specific date' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'date', required: true, description: 'YYYY-MM-DD' })
  getScheduleByDate(
    @Query('facilityId') facilityId: string,
    @Query('date') date: string,
  ) {
    return this.surgeryService.getScheduleByDate(facilityId, date);
  }

  @Get('schedule/week')
  @Auth()
  @ApiOperation({ summary: 'Get weekly surgery schedule' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD, defaults to today' })
  getWeekSchedule(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate?: string,
  ) {
    return this.surgeryService.getWeekSchedule(facilityId, startDate);
  }

  @Get('check-conflicts')
  @Auth()
  @ApiOperation({ summary: 'Check theatre availability for a time slot' })
  @ApiQuery({ name: 'theatreId', required: true })
  @ApiQuery({ name: 'date', required: true })
  @ApiQuery({ name: 'time', required: true })
  @ApiQuery({ name: 'duration', required: true })
  @ApiQuery({ name: 'excludeCaseId', required: false })
  checkConflicts(
    @Query('theatreId') theatreId: string,
    @Query('date') date: string,
    @Query('time') time: string,
    @Query('duration') duration: number,
    @Query('excludeCaseId') excludeCaseId?: string,
  ) {
    return this.surgeryService.checkTheatreConflicts(theatreId, date, time, duration, excludeCaseId);
  }
}
