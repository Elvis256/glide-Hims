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
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@UseGuards(ModuleGuard)
@RequireModule('ipd')
@Controller('discharge')
@UseGuards(AuthGuard('jwt'))
export class DischargeController {
  constructor(private readonly dischargeService: DischargeService) {}

  @Post()
  @AuthWithPermissions('discharge.create')
  async create(@Body() dto: CreateDischargeSummaryDto, @Request() req: any) {
    const facilityId =
      req.user.facilityId || req.headers['x-facility-id'] || req.tenantContext?.facilityId;
    return this.dischargeService.create(dto, req.user.sub, facilityId, req.user?.tenantId);
  }

  @Get()
  @AuthWithPermissions('discharge.read')
  async findAll(@Query() filter: DischargeSummaryFilterDto, @Request() req: any) {
    const facilityId =
      req.user.facilityId || req.headers['x-facility-id'] || req.tenantContext?.facilityId;
    return this.dischargeService.findAll(filter, facilityId, req.user?.tenantId);
  }

  @Get('stats')
  @AuthWithPermissions('discharge.read')
  async getStats(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Request() req: any,
  ) {
    const facilityId =
      req.user.facilityId || req.headers['x-facility-id'] || req.tenantContext?.facilityId;
    return this.dischargeService.getStats(
      facilityId,
      new Date(fromDate || new Date().setMonth(new Date().getMonth() - 1)),
      new Date(toDate || new Date()),
      req.user?.tenantId,
    );
  }

  @Get('patient/:patientId')
  @AuthWithPermissions('discharge.read')
  async findByPatient(@Param('patientId', ParseUUIDPipe) patientId: string, @Request() req: any) {
    return this.dischargeService.findByPatient(patientId, req.user?.tenantId);
  }

  @Get('encounter/:encounterId')
  @AuthWithPermissions('discharge.read')
  async findByEncounter(
    @Param('encounterId', ParseUUIDPipe) encounterId: string,
    @Request() req: any,
  ) {
    return this.dischargeService.findByEncounter(encounterId, req.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('discharge.read')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.dischargeService.findOne(id, req.user?.tenantId);
  }

  @Put(':id')
  @AuthWithPermissions('discharge.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateDischargeSummaryDto>,
    @Request() req: any,
  ) {
    return this.dischargeService.update(id, dto, req.user?.tenantId);
  }

  @Get(':id/print')
  @AuthWithPermissions('discharge.read')
  async printDischargeSummary(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.dischargeService.printDischargeSummary(id, req.user?.tenantId);
  }
}
