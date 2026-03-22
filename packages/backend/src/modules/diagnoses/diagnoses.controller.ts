import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DiagnosesService } from './diagnoses.service';
import { WHOICDService } from './who-icd.service';
import { CreateDiagnosisDto, UpdateDiagnosisDto, DiagnosisSearchDto, ImportDiagnosisDto, BulkImportDiagnosisDto } from './dto/diagnosis.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { DiagnosisCategory } from '../../database/entities/diagnosis.entity';

@ApiTags('diagnoses')
@Controller('diagnoses')
export class DiagnosesController {
  constructor(
    private readonly diagnosesService: DiagnosesService,
    private readonly whoICDService: WHOICDService,
  ) {}

  @Post()
  @AuthWithPermissions('diagnoses.create')
  @ApiOperation({ summary: 'Create diagnosis' })
  async create(@Body() dto: CreateDiagnosisDto, @Request() req: any) {
    const diagnosis = await this.diagnosesService.create(dto, req.user?.tenantId);
    return { message: 'Diagnosis created', data: diagnosis };
  }

  @Get()
  @AuthWithPermissions('diagnoses.read')
  @ApiOperation({ summary: 'List diagnoses' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'category', required: false, enum: DiagnosisCategory })
  @ApiQuery({ name: 'isNotifiable', required: false })
  @ApiQuery({ name: 'isChronic', required: false })
  async findAll(@Query() query: DiagnosisSearchDto, @Request() req: any) {
    return this.diagnosesService.findAll(query, req.user?.tenantId);
  }

  @Get('categories')
  @AuthWithPermissions('diagnoses.read')
  @ApiOperation({ summary: 'Get diagnosis categories' })
  async getCategories(@Request() req: any) {
    return this.diagnosesService.getCategories(req.user?.tenantId);
  }

  @Get('notifiable')
  @AuthWithPermissions('diagnoses.read')
  @ApiOperation({ summary: 'Get notifiable diseases' })
  async getNotifiableDiseases(@Request() req: any) {
    return this.diagnosesService.getNotifiableDiseases(req.user?.tenantId);
  }

  @Get('chronic')
  @AuthWithPermissions('diagnoses.read')
  @ApiOperation({ summary: 'Get chronic conditions' })
  async getChronicConditions(@Request() req: any) {
    return this.diagnosesService.getChronicConditions(req.user?.tenantId);
  }

  @Post('seed')
  @AuthWithPermissions('diagnoses.create')
  @ApiOperation({ summary: 'Seed common Uganda diagnoses' })
  async seedCommonDiagnoses(@Request() req: any) {
    const result = await this.diagnosesService.seedCommonDiagnoses(req.user?.tenantId);
    return { message: 'Diagnoses seeded', data: result };
  }

  // ========== WHO ICD API Endpoints (must be before :id route) ==========

  @Get('who/status')
  @AuthWithPermissions('diagnoses.read')
  @ApiOperation({ summary: 'Check WHO ICD API status and local database' })
  async getWHOStatus(@Request() req: any) {
    const status = await this.whoICDService.getStatus(req.user?.tenantId);
    return {
      configured: this.whoICDService.isConfigured(req.user?.tenantId),
      isOnline: status.isOnline,
      lastCheck: status.lastCheck,
      localCodesCount: status.localCodesCount,
      message: status.isOnline
        ? 'Online - using WHO ICD API with local caching'
        : 'Offline - using local ICD-10 database',
    };
  }

  @Post('who/seed')
  @AuthWithPermissions('diagnoses.create')
  @ApiOperation({ summary: 'Seed local ICD-10 code database with common codes' })
  async seedLocalCodes(@Request() req: any) {
    const count = await this.whoICDService.seedCommonCodes(req.user?.tenantId);
    return { message: `Seeded ${count} new ICD-10 codes`, seeded: count };
  }

  @Get('who/search')
  @AuthWithPermissions('diagnoses.read')
  @ApiOperation({ summary: 'Search ICD codes (online first, fallback to local)' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'version', required: false, enum: ['icd10', 'icd11', 'both'], description: 'ICD version to search' })
  @ApiQuery({ name: 'lang', required: false, description: 'Language code (default: en)' })
  async searchWHO(
    @Query('q') query: string,
    @Query('version') version: 'icd10' | 'icd11' | 'both' = 'icd10',
    @Query('lang') lang = 'en',
    @Request() req: any,
  ) {
    if (!query || query.length < 2) {
      return { data: [], message: 'Query must be at least 2 characters' };
    }

    const results = await this.whoICDService.search(query, version, lang, req.user?.tenantId);
    const source = results.length > 0 && results[0].source === 'online' ? 'WHO ICD API' : 'Local Database';
    
    return { 
      data: results,
      source,
      version,
      count: results.length,
    };
  }

  @Post('who/import')
  @AuthWithPermissions('diagnoses.create')
  @ApiOperation({ summary: 'Import diagnosis from WHO to local database' })
  async importFromWHO(@Body() dto: ImportDiagnosisDto, @Request() req: any) {
    const diagnosis = await this.whoICDService.importToLocal(dto.code, dto.version || 'ICD-10', req.user?.tenantId);
    if (!diagnosis) {
      return { success: false, message: `Code ${dto.code} not found in WHO API` };
    }
    return { success: true, message: 'Diagnosis imported', data: diagnosis };
  }

  @Post('who/bulk-import')
  @AuthWithPermissions('diagnoses.create')
  @ApiOperation({ summary: 'Bulk import diagnoses from WHO search results' })
  async bulkImportFromWHO(@Body() dto: BulkImportDiagnosisDto, @Request() req: any) {
    const imported = await this.whoICDService.bulkImport(dto.codes, req.user?.tenantId);
    return { success: true, message: `Imported ${imported} new diagnoses`, imported };
  }

  @Get('code/:code')
  @AuthWithPermissions('diagnoses.read')
  @ApiOperation({ summary: 'Get diagnosis by ICD-10 code' })
  async findByCode(@Param('code') code: string, @Request() req: any) {
    return this.diagnosesService.findByCode(code, req.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('diagnoses.read')
  @ApiOperation({ summary: 'Get diagnosis by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.diagnosesService.findOne(id, req.user?.tenantId);
  }

  @Patch(':id')
  @AuthWithPermissions('diagnoses.update')
  @ApiOperation({ summary: 'Update diagnosis' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDiagnosisDto, @Request() req: any) {
    const diagnosis = await this.diagnosesService.update(id, dto, req.user?.tenantId);
    return { message: 'Diagnosis updated', data: diagnosis };
  }

  @Delete(':id')
  @AuthWithPermissions('diagnoses.delete')
  @ApiOperation({ summary: 'Delete diagnosis' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    await this.diagnosesService.remove(id, req.user?.tenantId);
    return { message: 'Diagnosis deleted' };
  }
}
