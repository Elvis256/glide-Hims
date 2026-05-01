import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PosComplianceService } from './pos-compliance.service';
import { CreateDrawerEventDto, GenerateZReportDto } from './pos-compliance.dto';

@ApiTags('POS Compliance')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('pos')
@Controller('pos')
export class PosComplianceController {
  constructor(private readonly service: PosComplianceService) {}

  // ─── Cash drawer events ────────────────────────────────────────────────────

  @Post('drawer-events')
  @AuthWithPermissions('pos.drawer.manage')
  @ApiOperation({ summary: 'Record a cash drawer event (no-sale, paid-in, paid-out, cash-drop)' })
  createDrawerEvent(@Body() dto: CreateDrawerEventDto, @Request() req: any) {
    return this.service.createDrawerEvent(dto, req.user.id, req.user?.tenantId);
  }

  @Get('shifts/:shiftId/drawer-events')
  @AuthWithPermissions('pos.read')
  @ApiOperation({ summary: 'List drawer events for a shift' })
  listDrawerEvents(@Param('shiftId') shiftId: string, @Request() req: any) {
    return this.service.listDrawerEvents(shiftId, req.user?.tenantId);
  }

  // ─── X / Z reports ─────────────────────────────────────────────────────────

  @Get('shifts/:shiftId/x-report')
  @AuthWithPermissions('pos.shift')
  @ApiOperation({ summary: 'Live X-report for a shift (read-only, never persisted)' })
  getXReport(@Param('shiftId') shiftId: string, @Request() req: any) {
    return this.service.getXReport(shiftId, req.user?.tenantId);
  }

  @Post('shifts/:shiftId/z-report')
  @AuthWithPermissions('pos.shift.z_close')
  @ApiOperation({
    summary: 'Generate immutable Z-report and lock shift (z_finalized). One-time per shift.',
  })
  generateZReport(
    @Param('shiftId') shiftId: string,
    @Body() dto: GenerateZReportDto,
    @Request() req: any,
  ) {
    return this.service.generateZReport(shiftId, dto, req.user.id, req.user?.tenantId);
  }

  @Get('shifts/:shiftId/z-report')
  @AuthWithPermissions('pos.read')
  @ApiOperation({ summary: 'Fetch the Z-report for a shift' })
  getZReport(@Param('shiftId') shiftId: string, @Request() req: any) {
    return this.service.getZReport(shiftId, req.user?.tenantId);
  }

  @Get('z-reports')
  @AuthWithPermissions('pos.read')
  @ApiOperation({ summary: 'List Z-reports' })
  listZReports(@Request() req: any, @Query('registerId') registerId?: string) {
    return this.service.listZReports(req.user?.tenantId, registerId);
  }
}
