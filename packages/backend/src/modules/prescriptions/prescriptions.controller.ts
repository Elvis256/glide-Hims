import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto, DispenseItemDto, DispenseBatchDto, PrescriptionQueryDto, UpdateStatusDto, UpdatePrescriptionItemDto, AdministerMedicationDto } from './prescriptions.dto';
import { AuthWithPermissions, AuthWithOwnership } from '../auth/decorators/auth.decorator';

@ApiTags('Prescriptions')
@ApiBearerAuth()
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  @AuthWithPermissions('prescriptions.create')
  @ApiOperation({ summary: 'Create prescription' })
  create(@Body() dto: CreatePrescriptionDto, @Request() req: any) {
    return this.prescriptionsService.create(dto, req.user.id, req.user?.tenantId);
  }

  @Get()
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'List prescriptions' })
  findAll(@Query() query: PrescriptionQueryDto, @Request() req: any) {
    return this.prescriptionsService.findAll(query, req.user?.tenantId);
  }

  @Get('queue')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'Get pharmacy queue (pending prescriptions)' })
  getQueue(@Request() req: any) {
    return this.prescriptionsService.getPharmacyQueue(req.user?.tenantId);
  }

  @Get('search')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'Search prescriptions by patient name, MRN or Rx number' })
  search(@Query('q') q: string, @Request() req: any) {
    return this.prescriptionsService.search(q || '', req.user?.tenantId);
  }

  @Get('analytics/timing')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'Get prescription dispensing time analytics' })
  getTimingAnalytics(@Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string, @Request() req?: any) {
    return this.prescriptionsService.getTimingAnalytics(dateFrom, dateTo, req?.user?.tenantId);
  }

  @Get(':id')
  @AuthWithOwnership('prescriptions.read', {
    entity: 'Prescription',
    ownerField: 'prescribedById',
    bypassPermission: 'prescriptions.read-all',
    allowFacilityAccess: true,
  })
  @ApiOperation({ summary: 'Get prescription by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.prescriptionsService.findOne(id, req.user?.tenantId);
  }

  @Post('dispense')
  @AuthWithPermissions('prescriptions.update')
  @ApiOperation({ summary: 'Dispense prescription items (batch)' })
  dispenseBatch(@Body() dto: DispenseBatchDto, @Request() req: any) {
    return this.prescriptionsService.dispenseBatch(dto, req.user.id, req.user?.tenantId);
  }

  @Post('dispense-item')
  @AuthWithPermissions('prescriptions.update')
  @ApiOperation({ summary: 'Dispense a single prescription item' })
  dispenseItem(@Body() dto: DispenseItemDto, @Request() req: any) {
    return this.prescriptionsService.dispenseItem(dto, req.user.id, req.user?.tenantId);
  }

  @Patch(':id/status')
  @AuthWithPermissions('prescriptions.update')
  @ApiOperation({ summary: 'Update prescription workflow status (dispensing/ready/collected)' })
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStatusDto, @Request() req: any) {
    return this.prescriptionsService.updateStatus(id, dto, req.user?.tenantId);
  }

  @Post(':id/administer')
  @AuthWithPermissions('nursing.update')
  @ApiOperation({ summary: 'Record medication administration by nursing staff' })
  administerMedication(
    @Param('id') prescriptionItemId: string,
    @Body() dto: AdministerMedicationDto,
    @Request() req: any,
  ) {
    return this.prescriptionsService.administerMedication(prescriptionItemId, dto, req.user.id, req.user?.tenantId);
  }

  @Get(':id/administrations')
  @AuthWithPermissions('nursing.read')
  @ApiOperation({ summary: 'Get medication administration history for a prescription' })
  getAdministrationHistory(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.prescriptionsService.getAdministrationHistory(id, req.user?.tenantId);
  }

  @Patch('items/:itemId')
  @AuthWithPermissions('prescriptions.update')
  @ApiOperation({ summary: 'Update a prescription item (pharmacist edit)' })
  updateItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdatePrescriptionItemDto,
    @Request() req: any,
  ) {
    return this.prescriptionsService.updateItem(itemId, dto, req.user?.tenantId);
  }

  @Delete(':id/items/:itemId')
  @AuthWithPermissions('prescriptions.update')
  @ApiOperation({ summary: 'Remove a prescription item' })
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Request() req: any,
  ) {
    return this.prescriptionsService.removeItem(id, itemId, req.user?.tenantId);
  }

  @Patch(':id/cancel')
  @AuthWithPermissions('prescriptions.update')
  @ApiOperation({ summary: 'Cancel prescription' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.prescriptionsService.cancelPrescription(id, req.user?.tenantId);
  }
}
