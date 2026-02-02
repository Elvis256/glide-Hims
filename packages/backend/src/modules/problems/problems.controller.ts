import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProblemsService } from './problems.service';
import { CreateProblemDto, UpdateProblemDto, ProblemSearchDto, MarkResolvedDto } from './dto/problems.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { ProblemStatus } from '../../database/entities/patient-problem.entity';

@ApiTags('problems')
@Controller('problems')
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @Post()
  @AuthWithPermissions('problems.create')
  @ApiOperation({ summary: 'Create patient problem' })
  async create(@Query('facilityId', ParseUUIDPipe) facilityId: string, @Body() dto: CreateProblemDto, @Request() req: any) {
    const problem = await this.problemsService.create(facilityId, dto, req.user?.id);
    return { message: 'Problem created', data: problem };
  }

  @Get()
  @AuthWithPermissions('problems.read')
  @ApiOperation({ summary: 'List patient problems' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ProblemStatus })
  @ApiQuery({ name: 'search', required: false })
  async findAll(@Query('facilityId', ParseUUIDPipe) facilityId: string, @Query() query: ProblemSearchDto) {
    return this.problemsService.findAll(facilityId, query);
  }

  @Get('patient/:patientId')
  @AuthWithPermissions('problems.read')
  @ApiOperation({ summary: 'Get patient problems' })
  @ApiQuery({ name: 'status', required: false, enum: ProblemStatus })
  async findByPatient(@Param('patientId', ParseUUIDPipe) patientId: string, @Query('status') status?: ProblemStatus) {
    return this.problemsService.findByPatient(patientId, status);
  }

  @Get('patient/:patientId/stats')
  @AuthWithPermissions('problems.read')
  @ApiOperation({ summary: 'Get patient problem stats' })
  async getPatientStats(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.problemsService.getPatientStats(patientId);
  }

  @Get(':id')
  @AuthWithPermissions('problems.read')
  @ApiOperation({ summary: 'Get problem by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.problemsService.findOne(id);
  }

  @Patch(':id')
  @AuthWithPermissions('problems.update')
  @ApiOperation({ summary: 'Update problem' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProblemDto, @Request() req: any) {
    const problem = await this.problemsService.update(id, dto, req.user?.id);
    return { message: 'Problem updated', data: problem };
  }

  @Patch(':id/resolve')
  @AuthWithPermissions('problems.update')
  @ApiOperation({ summary: 'Mark problem as resolved' })
  async markResolved(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MarkResolvedDto, @Request() req: any) {
    const problem = await this.problemsService.markResolved(id, dto, req.user?.id);
    return { message: 'Problem marked as resolved', data: problem };
  }

  @Delete(':id')
  @AuthWithPermissions('problems.delete')
  @ApiOperation({ summary: 'Delete problem' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.problemsService.remove(id);
    return { message: 'Problem deleted' };
  }
}
