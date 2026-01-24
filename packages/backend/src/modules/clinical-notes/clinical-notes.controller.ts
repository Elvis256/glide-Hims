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
import { ClinicalNotesService } from './clinical-notes.service';
import { CreateClinicalNoteDto, UpdateClinicalNoteDto } from './clinical-notes.dto';
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('Clinical Notes')
@ApiBearerAuth()
@Controller('clinical-notes')
export class ClinicalNotesController {
  constructor(private readonly notesService: ClinicalNotesService) {}

  @Post()
  @Auth('Doctor', 'Nurse', 'Admin', 'Super Admin')
  @ApiOperation({ summary: 'Create clinical note (SOAP)' })
  create(@Body() dto: CreateClinicalNoteDto, @Request() req: any) {
    return this.notesService.create(dto, req.user.id);
  }

  @Get('encounter/:encounterId')
  @Auth()
  @ApiOperation({ summary: 'Get clinical notes for an encounter' })
  findByEncounter(@Param('encounterId', ParseUUIDPipe) encounterId: string) {
    return this.notesService.findByEncounter(encounterId);
  }

  @Get('patient/:patientId/history')
  @Auth()
  @ApiOperation({ summary: 'Get patient clinical history' })
  getPatientHistory(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query('limit') limit?: number,
  ) {
    return this.notesService.getPatientHistory(patientId, limit);
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Get clinical note by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.notesService.findOne(id);
  }

  @Patch(':id')
  @Auth('Doctor', 'Admin', 'Super Admin')
  @ApiOperation({ summary: 'Update clinical note' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClinicalNoteDto,
  ) {
    return this.notesService.update(id, dto);
  }

  @Delete(':id')
  @Auth('Admin', 'Super Admin')
  @ApiOperation({ summary: 'Delete clinical note' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.notesService.delete(id);
  }
}
