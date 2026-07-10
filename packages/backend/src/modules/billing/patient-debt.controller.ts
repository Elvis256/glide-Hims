import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { PatientDebtService } from './patient-debt.service';

class VisitBlockReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

@ApiTags('Patient Debt')
@Controller('patients/:patientId/debt')
export class PatientDebtController {
  constructor(private readonly debtService: PatientDebtService) {}

  @Get('summary')
  @AuthWithPermissions('billing.read')
  async getDebtSummary(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Req() req: any,
  ) {
    return this.debtService.getDebtSummary(patientId, req.user!.tenantId);
  }

  @Post('recalculate')
  @AuthWithPermissions('finance.manage')
  async recalculate(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Req() req: any,
  ) {
    return this.debtService.recalculatePatientDebt(patientId, req.user!.tenantId);
  }

  @Post('block')
  @AuthWithPermissions('finance.manage')
  async block(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: VisitBlockReasonDto,
    @Req() req: any,
  ) {
    await this.debtService.setVisitBlock({
      patientId,
      blocked: true,
      userId: req.user!.id,
      reason: dto.reason,
      tenantId: req.user!.tenantId,
    });
    return { blocked: true };
  }

  @Post('unblock')
  @AuthWithPermissions('finance.manage')
  async unblock(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: VisitBlockReasonDto,
    @Req() req: any,
  ) {
    await this.debtService.setVisitBlock({
      patientId,
      blocked: false,
      userId: req.user!.id,
      reason: dto.reason,
      tenantId: req.user!.tenantId,
    });
    return { blocked: false };
  }
}
