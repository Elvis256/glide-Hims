import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { CreatePatientDto, UpdatePatientDto, PatientSearchDto } from './dto/patient.dto';
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('patients')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Auth('Receptionist', 'Nurse', 'Doctor')
  @ApiOperation({ summary: 'Register new patient' })
  async create(@Body() dto: CreatePatientDto) {
    const patient = await this.patientsService.create(dto);
    return { message: 'Patient registered', data: patient };
  }

  @Post('check-duplicates')
  @Auth('Receptionist', 'Nurse', 'Doctor')
  @ApiOperation({ summary: 'Check for duplicate patients before registration' })
  async checkDuplicates(@Body() dto: CreatePatientDto) {
    const duplicates = await this.patientsService.checkDuplicates(dto);
    return {
      hasDuplicates: duplicates.length > 0,
      duplicates: duplicates.map((p) => ({
        id: p.id,
        mrn: p.mrn,
        fullName: p.fullName,
        dateOfBirth: p.dateOfBirth,
        phone: p.phone,
        nationalId: p.nationalId,
      })),
    };
  }

  @Get()
  @Auth()
  @ApiOperation({ summary: 'Search patients' })
  async findAll(@Query() query: PatientSearchDto) {
    return this.patientsService.findAll(query);
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Get patient by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.patientsService.findOne(id);
  }

  @Get('mrn/:mrn')
  @Auth()
  @ApiOperation({ summary: 'Get patient by MRN' })
  async findByMRN(@Param('mrn') mrn: string) {
    return this.patientsService.findByMRN(mrn);
  }

  @Patch(':id')
  @Auth('Receptionist', 'Nurse', 'Doctor')
  @ApiOperation({ summary: 'Update patient' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePatientDto) {
    const patient = await this.patientsService.update(id, dto);
    return { message: 'Patient updated', data: patient };
  }

  @Delete(':id')
  @Auth('Admin')
  @ApiOperation({ summary: 'Delete patient (soft delete)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.patientsService.remove(id);
    return { message: 'Patient deleted' };
  }
}
