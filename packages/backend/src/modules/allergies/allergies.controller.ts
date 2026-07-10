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
import { AllergiesService } from './allergies.service';
import { CreatePatientAllergyBodyDto, UpdatePatientAllergyBodyDto } from './allergies.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

interface AuthenticatedRequest extends Request {
  user?: { id: string; tenantId?: string; facilityId?: string; roles?: string[]; permissions?: string[]; isSystemAdmin?: boolean; };
}


@ApiTags('allergies')
@Controller('patients/:patientId/allergies')
export class AllergiesController {
  constructor(private readonly allergies: AllergiesService) {}

  @Get()
  @AuthWithPermissions('patients.read')
  @ApiOperation({ summary: 'List allergies for a patient' })
  list(@Param('patientId', ParseUUIDPipe) patientId: string, @Req() req: AuthenticatedRequest) {
    const tenantId = req.user?.tenantId;
    return this.allergies.list(patientId, tenantId);
  }

  @Post()
  @AuthWithPermissions('allergies.write')
  @ApiOperation({ summary: 'Record a new allergy for a patient' })
  create(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() body: CreatePatientAllergyBodyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    return this.allergies.create({ ...body, patientId }, userId, tenantId);
  }

  @Patch(':id')
  @AuthWithPermissions('allergies.write')
  @ApiOperation({ summary: 'Update an allergy record' })
  update(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePatientAllergyBodyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    return this.allergies.update(id, body, tenantId, patientId, userId);
  }

  @Patch(':id/inactivate')
  @AuthWithPermissions('allergies.write')
  @ApiOperation({ summary: 'Mark allergy inactive (preferred over delete)' })
  inactivate(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    return this.allergies.inactivate(id, tenantId, patientId, userId);
  }

  @Delete(':id')
  @AuthWithPermissions('allergies.delete')
  @ApiOperation({
    summary: 'Soft-delete an allergy (admin/clinician-lead only; prefer inactivate)',
  })
  async remove(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    await this.allergies.remove(id, tenantId, patientId, userId);
    return { ok: true };
  }
}
