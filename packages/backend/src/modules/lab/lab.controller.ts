import { Controller, Get, Post, Put, Patch, Body, Param, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { LabService } from './lab.service';
import {
  CreateLabTestDto, UpdateLabTestDto, CollectSampleDto, ReceiveSampleDto,
  RejectSampleDto, EnterResultDto, ValidateResultDto, AmendResultDto,
  LabTestQueryDto, SampleQueryDto,
} from './dto/lab.dto';

@ApiTags('Laboratory')
@ApiBearerAuth()
@Controller('lab')
export class LabController {
  constructor(private readonly labService: LabService) {}

  // ========== LAB TEST CATALOG ==========
  @Post('tests')
  @Auth()
  @ApiOperation({ summary: 'Create a lab test in catalog' })
  createLabTest(@Body() dto: CreateLabTestDto) {
    return this.labService.createLabTest(dto);
  }

  @Get('tests')
  @Auth()
  @ApiOperation({ summary: 'Get lab test catalog' })
  getLabTests(@Query() query: LabTestQueryDto) {
    return this.labService.getLabTests(query);
  }

  @Get('tests/:id')
  @Auth()
  @ApiOperation({ summary: 'Get lab test by ID' })
  getLabTest(@Param('id') id: string) {
    return this.labService.getLabTest(id);
  }

  @Patch('tests/:id')
  @Auth()
  @ApiOperation({ summary: 'Update lab test' })
  updateLabTest(@Param('id') id: string, @Body() dto: UpdateLabTestDto) {
    return this.labService.updateLabTest(id, dto);
  }

  // ========== SAMPLE MANAGEMENT ==========
  @Post('samples')
  @Auth()
  @ApiOperation({ summary: 'Collect a sample' })
  collectSample(@Body() dto: CollectSampleDto, @Request() req: any) {
    return this.labService.collectSample(dto, req.user.id);
  }

  @Get('samples')
  @Auth()
  @ApiOperation({ summary: 'Get samples list' })
  getSamples(@Query() query: SampleQueryDto) {
    return this.labService.getSamples(query);
  }

  @Get('samples/:id')
  @Auth()
  @ApiOperation({ summary: 'Get sample by ID' })
  getSample(@Param('id') id: string) {
    return this.labService.getSample(id);
  }

  @Put('samples/:id/receive')
  @Auth()
  @ApiOperation({ summary: 'Receive sample at lab' })
  receiveSample(@Param('id') id: string, @Body() dto: ReceiveSampleDto, @Request() req: any) {
    return this.labService.receiveSample(id, dto, req.user.id);
  }

  @Put('samples/:id/process')
  @Auth()
  @ApiOperation({ summary: 'Start processing sample' })
  startProcessing(@Param('id') id: string, @Request() req: any) {
    return this.labService.startProcessing(id, req.user.id);
  }

  @Put('samples/:id/reject')
  @Auth()
  @ApiOperation({ summary: 'Reject sample' })
  rejectSample(@Param('id') id: string, @Body() dto: RejectSampleDto, @Request() req: any) {
    return this.labService.rejectSample(id, dto, req.user.id);
  }

  // ========== RESULT MANAGEMENT ==========
  @Post('samples/:sampleId/results')
  @Auth()
  @ApiOperation({ summary: 'Enter result for a sample' })
  enterResult(@Param('sampleId') sampleId: string, @Body() dto: EnterResultDto, @Request() req: any) {
    return this.labService.enterResult(sampleId, dto, req.user.id);
  }

  @Get('samples/:sampleId/results')
  @Auth()
  @ApiOperation({ summary: 'Get results for a sample' })
  getResults(@Param('sampleId') sampleId: string) {
    return this.labService.getResults(sampleId);
  }

  @Put('results/:id/validate')
  @Auth()
  @ApiOperation({ summary: 'Validate a result' })
  validateResult(@Param('id') id: string, @Body() dto: ValidateResultDto, @Request() req: any) {
    return this.labService.validateResult(id, dto, req.user.id);
  }

  @Put('results/:id/release')
  @Auth()
  @ApiOperation({ summary: 'Release a result' })
  releaseResult(@Param('id') id: string, @Request() req: any) {
    return this.labService.releaseResult(id, req.user.id);
  }

  @Put('results/:id/amend')
  @Auth()
  @ApiOperation({ summary: 'Amend a released result' })
  amendResult(@Param('id') id: string, @Body() dto: AmendResultDto, @Request() req: any) {
    return this.labService.amendResult(id, dto, req.user.id);
  }

  // ========== DASHBOARD ==========
  @Get('queue')
  @Auth()
  @ApiOperation({ summary: 'Get lab queue summary' })
  getLabQueue(@Query('facilityId') facilityId: string) {
    return this.labService.getLabQueue(facilityId);
  }

  @Get('stats/turnaround')
  @Auth()
  @ApiOperation({ summary: 'Get turnaround time statistics' })
  getTurnaroundStats(@Query('facilityId') facilityId: string, @Query('days') days?: number) {
    return this.labService.getTurnaroundStats(facilityId, days);
  }
}
