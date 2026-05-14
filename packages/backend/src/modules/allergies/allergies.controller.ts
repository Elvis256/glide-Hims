import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import {
  AllergiesService,
  CreatePatientAllergyDto,
  UpdatePatientAllergyDto,
} from './allergies.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@ApiTags('allergies')
@Controller('patients/:patientId/allergies')
export class AllergiesController {
  constructor(private readonly allergies: AllergiesService) {}

  @Get()
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'List allergies for a patient' })
  list(@Param('patientId', ParseUUIDPipe) patientId: string, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.allergies.list(patientId, tenantId);
  }

  @Post()
  @AuthWithPermissions('allergies.write')
  @ApiOperation({ summary: 'Record a new allergy for a patient' })
  create(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() body: Omit<CreatePatientAllergyDto, 'patientId'>,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    const tenantId = (req as any).user?.tenantId;
    return this.allergies.create({ ...body, patientId }, userId, tenantId);
  }

  @Patch(':id')
  @AuthWithPermissions('allergies.write')
  @ApiOperation({ summary: 'Update an allergy record' })
  update(
    @Param('patientId', ParseUUIDPipe) _patientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePatientAllergyDto,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).user?.tenantId;
    return this.allergies.update(id, body, tenantId);
  }

  @Patch(':id/inactivate')
  @AuthWithPermissions('allergies.write')
  @ApiOperation({ summary: 'Mark allergy inactive (preferred over delete)' })
  inactivate(
    @Param('patientId', ParseUUIDPipe) _patientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).user?.tenantId;
    return this.allergies.inactivate(id, tenantId);
  }

  @Delete(':id')
  @AuthWithPermissions('allergies.delete')
  @ApiOperation({ summary: 'Soft-delete an allergy (admin/clinician-lead only; prefer inactivate)' })
  async remove(
    @Param('patientId', ParseUUIDPipe) _patientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).user?.tenantId;
    await this.allergies.remove(id, tenantId);
    return { ok: true };
  }
}
