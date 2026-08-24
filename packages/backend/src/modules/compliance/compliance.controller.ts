import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards, ParseEnumPipe } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags } from '@nestjs/swagger';
import {
  ComplianceRecord,
  ComplianceRecordType,
  COMPLIANCE_RECORD_TYPES,
} from './compliance-record.entity';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@ApiTags('Compliance')
@RequireModule('finance')
@UseGuards(ModuleGuard)
@Controller('compliance')
export class ComplianceController {
  constructor(
    @InjectRepository(ComplianceRecord)
    private readonly repo: Repository<ComplianceRecord>,
  ) {}

  @Get(':type')
  @AuthWithPermissions('audit.read')
  async list(
    @Param('type') type: ComplianceRecordType,
    @CurrentUser() user: any,
    @Query('limit') limit = 200,
  ) {
    const where: any = { recordType: type };
    if (user?.tenantId) where.tenantId = user.tenantId;
    const data = await this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      take: Math.min(Number(limit) || 200, 1000),
    });
    return { data };
  }

  @Post(':type')
  @AuthWithPermissions('audit.read')
  async create(
    // Validated against the enum, not taken on trust. `record_type` is
    // varchar(30); anything longer reached Postgres and came back as
    // "value too long for type character varying(30)" — a 500 for what is
    // plainly a bad request. The global filter deliberately does not map
    // SQLSTATE 22001, because a string overflow is as often the server
    // computing something wrong as it is bad input, so this is guarded at the
    // parameter instead of by loosening that rule for everyone.
    @Param('type', new ParseEnumPipe(COMPLIANCE_RECORD_TYPES)) type: ComplianceRecordType,
    @Body() payload: Record<string, any>,
    @CurrentUser() user: any,
  ) {
    const rec = this.repo.create({
      recordType: type,
      payload,
      createdBy: user?.id,
      tenantId: user?.tenantId,
    } as Partial<ComplianceRecord>);
    return this.repo.save(rec);
  }

  @Delete(':type/:id')
  @AuthWithPermissions('audit.read')
  async remove(
    @Param('type') type: ComplianceRecordType,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const where: any = { id, recordType: type };
    if (user?.tenantId) where.tenantId = user.tenantId;
    await this.repo.softDelete(where);
    return { deleted: true };
  }
}
