import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DiagnosesService } from './diagnoses.service';
import { CreateDiagnosisDto, UpdateDiagnosisDto, DiagnosisSearchDto } from './dto/diagnosis.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { DiagnosisCategory } from '../../database/entities/diagnosis.entity';

@ApiTags('diagnoses')
@Controller('diagnoses')
export class DiagnosesController {
  constructor(private readonly diagnosesService: DiagnosesService) {}

  @Post()
  @Auth('Admin')
  @ApiOperation({ summary: 'Create diagnosis' })
  async create(@Body() dto: CreateDiagnosisDto) {
    const diagnosis = await this.diagnosesService.create(dto);
    return { message: 'Diagnosis created', data: diagnosis };
  }

  @Get()
  @Auth()
  @ApiOperation({ summary: 'List diagnoses' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'category', required: false, enum: DiagnosisCategory })
  @ApiQuery({ name: 'isNotifiable', required: false })
  @ApiQuery({ name: 'isChronic', required: false })
  async findAll(@Query() query: DiagnosisSearchDto) {
    return this.diagnosesService.findAll(query);
  }

  @Get('categories')
  @Auth()
  @ApiOperation({ summary: 'Get diagnosis categories' })
  async getCategories() {
    return this.diagnosesService.getCategories();
  }

  @Get('notifiable')
  @Auth()
  @ApiOperation({ summary: 'Get notifiable diseases' })
  async getNotifiableDiseases() {
    return this.diagnosesService.getNotifiableDiseases();
  }

  @Get('chronic')
  @Auth()
  @ApiOperation({ summary: 'Get chronic conditions' })
  async getChronicConditions() {
    return this.diagnosesService.getChronicConditions();
  }

  @Post('seed')
  @Auth('Admin')
  @ApiOperation({ summary: 'Seed common Uganda diagnoses' })
  async seedCommonDiagnoses() {
    const result = await this.diagnosesService.seedCommonDiagnoses();
    return { message: 'Diagnoses seeded', data: result };
  }

  @Get('code/:code')
  @Auth()
  @ApiOperation({ summary: 'Get diagnosis by ICD-10 code' })
  async findByCode(@Param('code') code: string) {
    return this.diagnosesService.findByCode(code);
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Get diagnosis by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.diagnosesService.findOne(id);
  }

  @Patch(':id')
  @Auth('Admin')
  @ApiOperation({ summary: 'Update diagnosis' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDiagnosisDto) {
    const diagnosis = await this.diagnosesService.update(id, dto);
    return { message: 'Diagnosis updated', data: diagnosis };
  }

  @Delete(':id')
  @Auth('Admin')
  @ApiOperation({ summary: 'Delete diagnosis' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.diagnosesService.remove(id);
    return { message: 'Diagnosis deleted' };
  }
}
