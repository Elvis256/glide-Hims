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
import { CreatePrescriptionDto, DispenseItemDto, PrescriptionQueryDto } from './prescriptions.dto';
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('Prescriptions')
@ApiBearerAuth()
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  @Auth('Doctor', 'Admin', 'Super Admin')
  @ApiOperation({ summary: 'Create prescription' })
  create(@Body() dto: CreatePrescriptionDto, @Request() req: any) {
    return this.prescriptionsService.create(dto, req.user.id);
  }

  @Get()
  @Auth()
  @ApiOperation({ summary: 'List prescriptions' })
  findAll(@Query() query: PrescriptionQueryDto) {
    return this.prescriptionsService.findAll(query);
  }

  @Get('queue')
  @Auth('Pharmacist', 'Admin', 'Super Admin')
  @ApiOperation({ summary: 'Get pharmacy queue (pending prescriptions)' })
  getQueue() {
    return this.prescriptionsService.getPharmacyQueue();
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Get prescription by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptionsService.findOne(id);
  }

  @Post('dispense')
  @Auth('Pharmacist', 'Admin', 'Super Admin')
  @ApiOperation({ summary: 'Dispense a prescription item' })
  dispenseItem(@Body() dto: DispenseItemDto, @Request() req: any) {
    return this.prescriptionsService.dispenseItem(dto, req.user.id);
  }

  @Patch(':id/cancel')
  @Auth('Doctor', 'Admin', 'Super Admin')
  @ApiOperation({ summary: 'Cancel prescription' })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptionsService.cancelPrescription(id);
  }
}
