import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DiagnosesService } from './diagnoses.service';
import { WHOICDService } from './who-icd.service';
import { CreateDiagnosisDto, UpdateDiagnosisDto, DiagnosisSearchDto } from './dto/diagnosis.dto';
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
  async create(@Body() dto: CreateDiagnosisDto) {
    const diagnosis = await this.diagnosesService.create(dto);
    return { message: 'Diagnosis created', data: diagnosis };
  }

  @Get()
  @AuthWithPermissions('diagnoses.read')
  @ApiOperation({ summary: 'List diagnoses' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'category', required: false, enum: DiagnosisCategory })
  @ApiQuery({ name: 'isNotifiable', required: false })
  @ApiQuery({ name: 'isChronic', required: false })
  async findAll(@Query() query: DiagnosisSearchDto) {
    return this.diagnosesService.findAll(query);
  }

  @Get('categories')
  @AuthWithPermissions('diagnoses.read')
  @ApiOperation({ summary: 'Get diagnosis categories' })
  async getCategories() {
    return this.diagnosesService.getCategories();
  }

  @Get('notifiable')
  @AuthWithPermissions('diagnoses.read')
  @ApiOperation({ summary: 'Get notifiable diseases' })
  async getNotifiableDiseases() {
    return this.diagnosesService.getNotifiableDiseases();
  }

  @Get('chronic')
  @AuthWithPermissions('diagnoses.read')
  @ApiOperation({ summary: 'Get chronic conditions' })
  async getChronicConditions() {
    return this.diagnosesService.getChronicConditions();
  }

  @Post('seed')
  @AuthWithPermissions('diagnoses.create')
  @ApiOperation({ summary: 'Seed common Uganda diagnoses' })
  async seedCommonDiagnoses() {
    const result = await this.diagnosesService.seedCommonDiagnoses();
    return { message: 'Diagnoses seeded', data: result };
  }

  @Get('code/:code')
  @AuthWithPermissions('diagnoses.read')
  @ApiOperation({ summary: 'Get diagnosis by ICD-10 code' })
  async findByCode(@Param('code') code: string) {
    return this.diagnosesService.findByCode(code);
  }

  @Get(':id')
  @AuthWithPermissions('diagnoses.read')
  @ApiOperation({ summary: 'Get diagnosis by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.diagnosesService.findOne(id);
  }

  @Patch(':id')
  @AuthWithPermissions('diagnoses.update')
  @ApiOperation({ summary: 'Update diagnosis' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDiagnosisDto) {
    const diagnosis = await this.diagnosesService.update(id, dto);
    return { message: 'Diagnosis updated', data: diagnosis };
  }

  @Delete(':id')
  @AuthWithPermissions('diagnoses.delete')
  @ApiOperation({ summary: 'Delete diagnosis' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.diagnosesService.remove(id);
    return { message: 'Diagnosis deleted' };
  }

  // ========== WHO ICD API Endpoints ==========

  @Get('who/status')
  @AuthWithPermissions('diagnoses.read')
  @ApiOperation({ summary: 'Check WHO ICD API status' })
  async getWHOStatus() {
    return {
      configured: this.whoICDService.isConfigured(),
      message: this.whoICDService.isConfigured()
        ? 'WHO ICD API is configured and ready'
        : 'WHO ICD API credentials not configured. Set WHO_ICD_CLIENT_ID and WHO_ICD_CLIENT_SECRET in environment.',
    };
  }

  @Get('who/search')
  @AuthWithPermissions('diagnoses.read')
  @ApiOperation({ summary: 'Search ICD codes from WHO API (real-time)' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'version', required: false, enum: ['icd10', 'icd11', 'both'], description: 'ICD version to search' })
  @ApiQuery({ name: 'lang', required: false, description: 'Language code (default: en)' })
  async searchWHO(
    @Query('q') query: string,
    @Query('version') version: 'icd10' | 'icd11' | 'both' = 'both',
    @Query('lang') lang = 'en',
  ) {
    if (!query || query.length < 2) {
      return { data: [], message: 'Query must be at least 2 characters' };
    }

    if (!this.whoICDService.isConfigured()) {
      return { 
        data: [], 
        error: true,
        message: 'WHO ICD API not configured. Use local search or configure API credentials.',
      };
    }

    const results = await this.whoICDService.search(query, version, lang);
    return { 
      data: results,
      source: 'WHO ICD API',
      version,
      count: results.length,
    };
  }

  @Post('who/import')
  @AuthWithPermissions('diagnoses.create')
  @ApiOperation({ summary: 'Import diagnosis from WHO to local database' })
  async importFromWHO(@Body() dto: { code: string; version?: 'ICD-10' | 'ICD-11' }) {
    const diagnosis = await this.whoICDService.importToLocal(dto.code, dto.version || 'ICD-10');
    if (!diagnosis) {
      return { success: false, message: `Code ${dto.code} not found in WHO API` };
    }
    return { success: true, message: 'Diagnosis imported', data: diagnosis };
  }

  @Post('who/bulk-import')
  @AuthWithPermissions('diagnoses.create')
  @ApiOperation({ summary: 'Bulk import diagnoses from WHO search results' })
  async bulkImportFromWHO(@Body() dto: { codes: Array<{ code: string; title: string; chapter?: string }> }) {
    const imported = await this.whoICDService.bulkImport(dto.codes);
    return { success: true, message: `Imported ${imported} new diagnoses`, imported };
  }
}
