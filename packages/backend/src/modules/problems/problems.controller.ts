import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProblemsService } from './problems.service';
import {
  CreateProblemDto,
  UpdateProblemDto,
  ProblemSearchDto,
  MarkResolvedDto,
} from './dto/problems.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { ProblemStatus } from '../../database/entities/patient-problem.entity';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@ApiTags('problems')
@UseGuards(ModuleGuard)
@RequireModule('doctors')
@Controller('problems')
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @Post()
  @AuthWithPermissions('problems.create')
  @ApiOperation({ summary: 'Create patient problem' })
  async create(
    @Query('facilityId', ParseUUIDPipe) facilityId: string,
    @Body() dto: CreateProblemDto,
    @Request() req: any,
  ) {
    const problem = await this.problemsService.create(
      facilityId,
      dto,
      req.user?.id,
      req.user?.tenantId,
    );
    return { message: 'Problem created', data: problem };
  }

  @Get()
  @AuthWithPermissions('problems.read')
  @ApiOperation({ summary: 'List patient problems' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ProblemStatus })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('facilityId', ParseUUIDPipe) facilityId: string,
    @Query() query: ProblemSearchDto,
    @Request() req: any,
  ) {
    return this.problemsService.findAll(facilityId, query, req.user?.tenantId);
  }

  @Get('patient/:patientId')
  @AuthWithPermissions('problems.read')
  @ApiOperation({ summary: 'Get patient problems' })
  @ApiQuery({ name: 'status', required: false, enum: ProblemStatus })
  async findByPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query('status') status?: ProblemStatus,
    @Request() req?: any,
  ) {
    return this.problemsService.findByPatient(patientId, status, req?.user?.tenantId);
  }

  @Get('patient/:patientId/stats')
  @AuthWithPermissions('problems.read')
  @ApiOperation({ summary: 'Get patient problem stats' })
  async getPatientStats(@Param('patientId', ParseUUIDPipe) patientId: string, @Request() req: any) {
    return this.problemsService.getPatientStats(patientId, req.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('problems.read')
  @ApiOperation({ summary: 'Get problem by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.problemsService.findOne(id, req.user?.tenantId);
  }

  @Patch(':id')
  @AuthWithPermissions('problems.update')
  @ApiOperation({ summary: 'Update problem' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProblemDto,
    @Request() req: any,
  ) {
    const problem = await this.problemsService.update(id, dto, req.user?.id, req.user?.tenantId);
    return { message: 'Problem updated', data: problem };
  }

  @Patch(':id/resolve')
  @AuthWithPermissions('problems.update')
  @ApiOperation({ summary: 'Mark problem as resolved' })
  async markResolved(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkResolvedDto,
    @Request() req: any,
  ) {
    const problem = await this.problemsService.markResolved(
      id,
      dto,
      req.user?.id,
      req.user?.tenantId,
    );
    return { message: 'Problem marked as resolved', data: problem };
  }

  @Delete(':id')
  @AuthWithPermissions('problems.delete')
  @ApiOperation({ summary: 'Delete problem' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    await this.problemsService.remove(id, req.user?.tenantId);
    return { message: 'Problem deleted' };
  }
}
