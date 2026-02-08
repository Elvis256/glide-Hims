import { Controller, Get, Post, Put, Patch, Body, Param, Query, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { LabService } from './lab.service';
import {
  CreateLabTestDto, UpdateLabTestDto, CollectSampleDto, ReceiveSampleDto,
  RejectSampleDto, EnterResultDto, ValidateResultDto, AmendResultDto,
  LabTestQueryDto, SampleQueryDto,
} from './dto/lab.dto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@ApiTags('Laboratory')
@ApiBearerAuth()
@Controller('lab')
export class LabController {
  constructor(private readonly labService: LabService) {}

  // ========== LAB TEST CATALOG ==========
  @Post('tests')
  @AuthWithPermissions('lab.create')
  @ApiOperation({ summary: 'Create a lab test in catalog' })
  createLabTest(@Body() dto: CreateLabTestDto) {
    return this.labService.createLabTest(dto);
  }

  @Get('tests')
  @AuthWithPermissions('lab.read')
  @ApiOperation({ summary: 'Get lab test catalog' })
  getLabTests(@Query() query: LabTestQueryDto) {
    return this.labService.getLabTests(query);
  }

  @Get('tests/:id')
  @AuthWithPermissions('lab.read')
  @ApiOperation({ summary: 'Get lab test by ID' })
  getLabTest(@Param('id') id: string) {
    return this.labService.getLabTest(id);
  }

  @Patch('tests/:id')
  @AuthWithPermissions('lab.update')
  @ApiOperation({ summary: 'Update lab test' })
  updateLabTest(@Param('id') id: string, @Body() dto: UpdateLabTestDto) {
    return this.labService.updateLabTest(id, dto);
  }

  // ========== SAMPLE MANAGEMENT ==========
  @Post('samples')
  @AuthWithPermissions('lab.create')
  @ApiOperation({ summary: 'Collect a sample' })
  collectSample(@Body() dto: CollectSampleDto, @Request() req: any) {
    return this.labService.collectSample(dto, req.user.id);
  }

  @Get('samples')
  @AuthWithPermissions('lab.read')
  @ApiOperation({ summary: 'Get samples list' })
  getSamples(@Query() query: SampleQueryDto) {
    return this.labService.getSamples(query);
  }

  @Get('samples/:id')
  @AuthWithPermissions('lab.read')
  @ApiOperation({ summary: 'Get sample by ID' })
  getSample(@Param('id') id: string) {
    return this.labService.getSample(id);
  }

  @Put('samples/:id/receive')
  @AuthWithPermissions('lab.update')
  @ApiOperation({ summary: 'Receive sample at lab' })
  receiveSample(@Param('id') id: string, @Body() dto: ReceiveSampleDto, @Request() req: any) {
    return this.labService.receiveSample(id, dto, req.user.id);
  }

  @Put('samples/:id/process')
  @AuthWithPermissions('lab.update')
  @ApiOperation({ summary: 'Start processing sample' })
  startProcessing(@Param('id') id: string, @Request() req: any) {
    return this.labService.startProcessing(id, req.user.id);
  }

  @Put('samples/:id/reject')
  @AuthWithPermissions('lab.update')
  @ApiOperation({ summary: 'Reject sample' })
  rejectSample(@Param('id') id: string, @Body() dto: RejectSampleDto, @Request() req: any) {
    return this.labService.rejectSample(id, dto, req.user.id);
  }

  // ========== RESULT MANAGEMENT ==========
  @Post('samples/:sampleId/results')
  @AuthWithPermissions('lab.create')
  @ApiOperation({ summary: 'Enter result for a sample' })
  enterResult(@Param('sampleId') sampleId: string, @Body() dto: EnterResultDto, @Request() req: any) {
    return this.labService.enterResult(sampleId, dto, req.user.id);
  }

  @Get('samples/:sampleId/results')
  @AuthWithPermissions('lab.read')
  @ApiOperation({ summary: 'Get results for a sample' })
  getResults(@Param('sampleId') sampleId: string) {
    return this.labService.getResults(sampleId);
  }

  @Put('results/:id/validate')
  @AuthWithPermissions('lab.update')
  @ApiOperation({ summary: 'Validate a result' })
  validateResult(@Param('id') id: string, @Body() dto: ValidateResultDto, @Request() req: any) {
    return this.labService.validateResult(id, dto, req.user.id);
  }

  @Put('results/:id/release')
  @AuthWithPermissions('lab.update')
  @ApiOperation({ summary: 'Release a result' })
  releaseResult(@Param('id') id: string, @Request() req: any) {
    return this.labService.releaseResult(id, req.user.id);
  }

  @Put('results/:id/amend')
  @AuthWithPermissions('lab.update')
  @ApiOperation({ summary: 'Amend a released result' })
  amendResult(@Param('id') id: string, @Body() dto: AmendResultDto, @Request() req: any) {
    return this.labService.amendResult(id, dto, req.user.id);
  }

  // ========== DASHBOARD ==========
  @Get('queue/stats')
  @AuthWithPermissions('lab.read')
  @ApiOperation({ summary: 'Get lab queue statistics for dashboard' })
  getQueueStats(@Request() req: any) {
    const facilityId = req.headers['x-facility-id'] || req.user?.facilityId;
    return this.labService.getQueueStats(facilityId);
  }

  @Get('queue')
  @AuthWithPermissions('lab.read')
  @ApiOperation({ summary: 'Get lab queue summary' })
  @ApiQuery({ name: 'facilityId', required: true, description: 'Facility UUID' })
  getLabQueue(@Query('facilityId') facilityId: string) {
    if (!facilityId || !UUID_REGEX.test(facilityId)) {
      throw new BadRequestException('Valid facilityId UUID is required');
    }
    return this.labService.getLabQueue(facilityId);
  }

  @Get('stats/turnaround')
  @AuthWithPermissions('lab.read')
  @ApiOperation({ summary: 'Get turnaround time statistics' })
  @ApiQuery({ name: 'facilityId', required: true, description: 'Facility UUID' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days for stats (1-365)' })
  getTurnaroundStats(@Query('facilityId') facilityId: string, @Query('days') days?: number) {
    if (!facilityId || !UUID_REGEX.test(facilityId)) {
      throw new BadRequestException('Valid facilityId UUID is required');
    }
    return this.labService.getTurnaroundStats(facilityId, days);
  }
}
