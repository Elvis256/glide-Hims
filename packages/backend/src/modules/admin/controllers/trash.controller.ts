import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  BadRequestException,
  NotFoundException,
  Request,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull, Not } from 'typeorm';
import { AuthWithPermissions } from '../../auth/decorators/auth.decorator';
import { User } from '../../../database/entities/user.entity';
import { Patient } from '../../../database/entities/patient.entity';
import { Role } from '../../../database/entities/role.entity';

const TRASH_TYPES: Record<string, { entity: any; label: string }> = {
  users: { entity: User, label: 'User' },
  patients: { entity: Patient, label: 'Patient' },
  roles: { entity: Role, label: 'Role' },
};

@ApiTags('Admin - Trash')
@ApiBearerAuth()
@Controller('admin/trash')
export class TrashController {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  @Get()
  @AuthWithPermissions('users.delete')
  @ApiOperation({ summary: 'List soft-deleted records across supported types' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async list(
    @Query('type') type?: string,
    @Query('limit') limit?: number,
    @Request() req?: any,
  ) {
    const tenantId = req?.user?.tenantId;
    const types = type ? [type] : Object.keys(TRASH_TYPES);
    const result: any[] = [];
    for (const t of types) {
      const meta = TRASH_TYPES[t];
      if (!meta) continue;
      const repo = this.dataSource.getRepository(meta.entity);
      const where: any = { deletedAt: Not(IsNull()) };
      if (tenantId) where.tenantId = tenantId;
      const items = await repo.find({
        where,
        withDeleted: true,
        take: Number(limit) || 100,
        order: { deletedAt: 'DESC' as any },
      });
      for (const it of items as any[]) {
        result.push({
          type: t,
          label: meta.label,
          id: it.id,
          name: it.fullName || it.name || it.username || it.id,
          deletedAt: it.deletedAt,
        });
      }
    }
    return { data: result, meta: { total: result.length } };
  }

  @Post(':type/:id/restore')
  @AuthWithPermissions('users.delete')
  @ApiOperation({ summary: 'Restore a soft-deleted record' })
  async restore(
    @Param('type') type: string,
    @Param('id') id: string,
    @Request() req?: any,
  ) {
    const meta = TRASH_TYPES[type];
    if (!meta) throw new BadRequestException(`Unsupported trash type: ${type}`);
    const repo = this.dataSource.getRepository(meta.entity);
    const tenantId = req?.user?.tenantId;
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const found = await repo.findOne({ where, withDeleted: true });
    if (!found) throw new NotFoundException(`${meta.label} not found`);
    await repo.restore(id);
    return { success: true, type, id, label: meta.label };
  }
}
