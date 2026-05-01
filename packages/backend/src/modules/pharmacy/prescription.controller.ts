import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PrescriptionLookupService, PrescriptionItemDraft } from './prescription-lookup.service';
import {
  IsArray,
  IsNumber,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class ItemSelectionDto {
  @ApiProperty()
  @IsUUID()
  prescriptionItemId: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  qtyToDispense: number;
}

class FromPrescriptionDto {
  @ApiProperty({ type: [ItemSelectionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemSelectionDto)
  itemSelections: ItemSelectionDto[];
}

@ApiTags('Prescriptions')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('pharmacy')
@Controller('prescriptions')
export class PrescriptionController {
  constructor(private readonly service: PrescriptionLookupService) {}

  /**
   * C2: Look up prescription by prescriptionNumber code.
   * Returns Rx summary with remaining dispensable quantities and patient info.
   */
  @Get('by-code/:code')
  @AuthWithPermissions('pos.prescription.dispense')
  @ApiOperation({ summary: 'Look up prescription by number/code for POS dispensing' })
  findByCode(@Param('code') code: string, @Request() req: any) {
    return this.service.findByCode(code, req.user?.tenantId);
  }

  /**
   * C2: Build a draft POS cart from selected prescription items.
   * Returns cart payload — frontend opens this in POS sale screen for confirmation.
   * Does NOT create a sale yet.
   */
  @Post('from-prescription/:prescriptionId/draft-cart')
  @AuthWithPermissions('pos.prescription.dispense')
  @ApiOperation({ summary: 'Build draft POS cart from prescription items' })
  buildCartDraft(
    @Param('prescriptionId') prescriptionId: string,
    @Body() dto: FromPrescriptionDto,
    @Request() req: any,
  ) {
    return this.service.buildCartFromPrescription(
      prescriptionId,
      dto.itemSelections as PrescriptionItemDraft[],
      req.user?.tenantId,
    );
  }
}
