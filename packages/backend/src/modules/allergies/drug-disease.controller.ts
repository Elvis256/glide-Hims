import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DrugDiseaseService } from './drug-disease.service';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { DrugDiseaseSeverity } from '../../database/entities/drug-disease-interaction.entity';

export class CreateDrugDiseaseInteractionDto {
  @IsOptional()
  @IsUUID()
  drugClassificationId?: string;

  @IsOptional()
  @IsUUID()
  drugId?: string;

  @IsOptional()
  @IsString()
  atcCode?: string;

  @IsString()
  icd10Code: string;

  @IsEnum(DrugDiseaseSeverity)
  severity: DrugDiseaseSeverity;

  @IsString()
  @MaxLength(2000)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  clinicalEffects?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  recommendation?: string;
}

export class UpdateDrugDiseaseInteractionDto {
  @IsOptional()
  @IsEnum(DrugDiseaseSeverity)
  severity?: DrugDiseaseSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  clinicalEffects?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  recommendation?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller('drug-disease-interactions')
export class DrugDiseaseController {
  constructor(private readonly service: DrugDiseaseService) {}

  @Post()
  @AuthWithPermissions('drug-management.manage')
  create(
    @Body() dto: CreateDrugDiseaseInteractionDto,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.service.create(dto, tenantId);
  }

  @Get()
  @AuthWithPermissions('drug-management.manage')
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get('by-drug/:drugId')
  @AuthWithPermissions('drug-management.manage')
  findByDrug(
    @Param('drugId') drugId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.service.findByDrug(drugId, tenantId);
  }

  @Get('by-diagnosis/:icd10Code')
  @AuthWithPermissions('drug-management.manage')
  findByDiagnosis(
    @Param('icd10Code') icd10Code: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.service.findByDiagnosis(icd10Code, tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('drug-management.manage')
  findOne(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.service.findOne(id, tenantId);
  }

  @Patch(':id')
  @AuthWithPermissions('drug-management.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDrugDiseaseInteractionDto,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.service.update(id, dto, tenantId);
  }

  @Delete(':id')
  @AuthWithPermissions('drug-management.manage')
  remove(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.service.remove(id, tenantId);
  }
}
