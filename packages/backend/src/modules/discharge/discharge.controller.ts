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

@Controller('discharge')
@UseGuards(AuthGuard('jwt'))
export class DischargeController {
  constructor(private readonly dischargeService: DischargeService) {}

  @Post()
  async create(@Body() dto: CreateDischargeSummaryDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.dischargeService.create(dto, req.user.sub, facilityId);
  }

  @Get()
  async findAll(@Query() filter: DischargeSummaryFilterDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.dischargeService.findAll(filter, facilityId);
  }

  @Get('stats')
  async getStats(@Query('fromDate') fromDate: string, @Query('toDate') toDate: string, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.dischargeService.getStats(
      facilityId,
      new Date(fromDate || new Date().setMonth(new Date().getMonth() - 1)),
      new Date(toDate || new Date()),
    );
  }

  @Get('patient/:patientId')
  async findByPatient(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.dischargeService.findByPatient(patientId);
  }

  @Get('encounter/:encounterId')
  async findByEncounter(@Param('encounterId', ParseUUIDPipe) encounterId: string) {
    return this.dischargeService.findByEncounter(encounterId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.dischargeService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateDischargeSummaryDto>,
  ) {
    return this.dischargeService.update(id, dto);
  }

  @Get(':id/print')
  async printDischargeSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.dischargeService.printDischargeSummary(id);
  }
}
