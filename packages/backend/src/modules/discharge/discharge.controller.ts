import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DischargeService } from './discharge.service';
import { CreateDischargeSummaryDto, DischargeSummaryFilterDto } from './dto/discharge.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@Controller('discharge')
@UseGuards(AuthGuard('jwt'))
export class DischargeController {
  constructor(private readonly dischargeService: DischargeService) {}

  @Post()
  @AuthWithPermissions('discharge.create')
  async create(@Body() dto: CreateDischargeSummaryDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.dischargeService.create(dto, req.user.sub, facilityId);
  }

  @Get()
  @AuthWithPermissions('discharge.read')
  async findAll(@Query() filter: DischargeSummaryFilterDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.dischargeService.findAll(filter, facilityId);
  }

  @Get('stats')
  @AuthWithPermissions('discharge.read')
  async getStats(@Query('fromDate') fromDate: string, @Query('toDate') toDate: string, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.dischargeService.getStats(
      facilityId,
      new Date(fromDate || new Date().setMonth(new Date().getMonth() - 1)),
      new Date(toDate || new Date()),
    );
  }

  @Get('patient/:patientId')
  @AuthWithPermissions('discharge.read')
  async findByPatient(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.dischargeService.findByPatient(patientId);
  }

  @Get('encounter/:encounterId')
  @AuthWithPermissions('discharge.read')
  async findByEncounter(@Param('encounterId', ParseUUIDPipe) encounterId: string) {
    return this.dischargeService.findByEncounter(encounterId);
  }

  @Get(':id')
  @AuthWithPermissions('discharge.read')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.dischargeService.findOne(id);
  }

  @Put(':id')
  @AuthWithPermissions('discharge.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateDischargeSummaryDto>,
  ) {
    return this.dischargeService.update(id, dto);
  }

  @Get(':id/print')
  @AuthWithPermissions('discharge.read')
  async printDischargeSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.dischargeService.printDischargeSummary(id);
  }
}
