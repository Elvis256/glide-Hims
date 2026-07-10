import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MedicationReconciliationService } from './medication-reconciliation.service';
import { IsOptional, IsEnum, IsString, MaxLength } from 'class-validator';
import { ReconciliationItemStatus } from '../../database/entities/medication-reconciliation.entity';

export class UpdateReconciliationItemDto {
  @IsOptional()
  @IsEnum(ReconciliationItemStatus)
  reconciliationStatus?: ReconciliationItemStatus;

  @IsOptional()
  @IsString()
  dischargeDose?: string;

  @IsOptional()
  @IsString()
  dischargeFrequency?: string;

  @IsOptional()
  @IsString()
  dischargeDuration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  dischargeInstructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

@Controller('medication-reconciliations')
export class MedicationReconciliationController {
  constructor(private readonly service: MedicationReconciliationService) {}

  @Get('by-discharge/:dischargeSummaryId')
  @AuthWithPermissions('discharge.read')
  findByDischarge(
    @Param('dischargeSummaryId') dischargeSummaryId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.service.findByDischarge(dischargeSummaryId, tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('discharge.read')
  findById(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.service.findById(id, tenantId);
  }

  @Patch('items/:itemId')
  @AuthWithPermissions('discharge.create')
  updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateReconciliationItemDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.service.updateItem(itemId, dto, userId, tenantId);
  }

  @Post(':id/complete')
  @AuthWithPermissions('discharge.create')
  complete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.service.completeReconciliation(id, userId, tenantId);
  }

  @Post(':id/sign')
  @AuthWithPermissions('discharge.create')
  sign(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.service.signReconciliation(id, userId, tenantId);
  }
}
