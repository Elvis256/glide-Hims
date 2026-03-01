import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto, DispenseItemDto, DispenseBatchDto, PrescriptionQueryDto, UpdateStatusDto, AdministerMedicationDto } from './prescriptions.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@ApiTags('Prescriptions')
@ApiBearerAuth()
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  @AuthWithPermissions('prescriptions.create')
  @ApiOperation({ summary: 'Create prescription' })
  create(@Body() dto: CreatePrescriptionDto, @Request() req: any) {
    return this.prescriptionsService.create(dto, req.user.id);
  }

  @Get()
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'List prescriptions' })
  findAll(@Query() query: PrescriptionQueryDto, @Request() req: any) {
    return this.prescriptionsService.findAll(query, req.user?.facilityId);
  }

  @Get('queue')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'Get pharmacy queue (pending prescriptions)' })
  getQueue(@Request() req: any) {
    return this.prescriptionsService.getPharmacyQueue(req.user?.facilityId);
  }

  @Get('search')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'Search prescriptions by patient name, MRN or Rx number' })
  search(@Query('q') q: string, @Request() req: any) {
    return this.prescriptionsService.search(q || '', req.user?.facilityId);
  }

  @Get(':id')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'Get prescription by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const facilityId = req.user?.facilityId || req.headers?.['x-facility-id'];
    return this.prescriptionsService.findOne(id, facilityId);
  }

  @Post('dispense')
  @AuthWithPermissions('prescriptions.update')
  @ApiOperation({ summary: 'Dispense prescription items (batch)' })
  dispenseBatch(@Body() dto: DispenseBatchDto, @Request() req: any) {
    return this.prescriptionsService.dispenseBatch(dto, req.user.id);
  }

  @Post('dispense-item')
  @AuthWithPermissions('prescriptions.update')
  @ApiOperation({ summary: 'Dispense a single prescription item' })
  dispenseItem(@Body() dto: DispenseItemDto, @Request() req: any) {
    return this.prescriptionsService.dispenseItem(dto, req.user.id);
  }

  @Patch(':id/status')
  @AuthWithPermissions('prescriptions.update')
  @ApiOperation({ summary: 'Update prescription workflow status (dispensing/ready/collected)' })
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStatusDto) {
    return this.prescriptionsService.updateStatus(id, dto);
  }

  @Post(':id/administer')
  @AuthWithPermissions('nursing.update')
  @ApiOperation({ summary: 'Record medication administration by nursing staff' })
  administerMedication(
    @Param('id') prescriptionItemId: string,
    @Body() dto: AdministerMedicationDto,
    @Request() req: any,
  ) {
    return this.prescriptionsService.administerMedication(prescriptionItemId, dto, req.user.id);
  }

  @Get(':id/administrations')
  @AuthWithPermissions('nursing.read')
  @ApiOperation({ summary: 'Get medication administration history for a prescription' })
  getAdministrationHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptionsService.getAdministrationHistory(id);
  }

  @Patch(':id/cancel')
  @AuthWithPermissions('prescriptions.update')
  @ApiOperation({ summary: 'Cancel prescription' })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptionsService.cancelPrescription(id);
  }
}
