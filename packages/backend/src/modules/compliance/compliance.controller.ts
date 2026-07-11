import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags } from '@nestjs/swagger';
import { ComplianceRecord, ComplianceRecordType } from './compliance-record.entity';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';

@ApiTags('Compliance')
@RequireModule('finance')
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
    @Param('type') type: ComplianceRecordType,
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
