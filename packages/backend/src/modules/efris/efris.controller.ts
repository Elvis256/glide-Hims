import { Controller, Get, Post, Put, Body, Param, Query, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { EfrisService } from './efris.service';
import { RequireModule } from '../auth/decorators/module.decorator';
import { UpsertEfrisConfigDto } from './efris.dto';
import { EfrisDocumentStatus } from '../../database/entities/pos-compliance.entity';

@ApiTags('EFRIS')
@ApiBearerAuth()
@RequireModule('finance')
@Controller('efris')
export class EfrisController {
  constructor(private readonly service: EfrisService) {}

  @Get('config')
  @AuthWithPermissions('efris.config')
  @ApiOperation({ summary: 'Get EFRIS configuration for current tenant' })
  getConfig(@Request() req: any) {
    return this.service.getConfig(req.user?.tenantId);
  }

  @Put('config')
  @AuthWithPermissions('efris.config')
  @ApiOperation({ summary: 'Create or update EFRIS configuration' })
  upsertConfig(@Body() dto: UpsertEfrisConfigDto, @Request() req: any) {
    return this.service.upsertConfig(dto, req.user?.tenantId);
  }

  @Get('documents')
  @AuthWithPermissions('efris.read')
  @ApiOperation({ summary: 'List EFRIS documents (fiscal invoices)' })
  list(@Request() req: any, @Query('status') status?: EfrisDocumentStatus) {
    return this.service.listDocuments(req.user?.tenantId, status);
  }

  @Get('documents/:id')
  @AuthWithPermissions('efris.read')
  @ApiOperation({ summary: 'Get EFRIS document detail' })
  get(@Param('id') id: string, @Request() req: any) {
    return this.service.getDocument(id, req.user?.tenantId);
  }

  @Post('documents/:id/retry')
  @AuthWithPermissions('efris.retry')
  @ApiOperation({ summary: 'Retry submission of a rejected/failed EFRIS document' })
  retry(@Param('id') id: string, @Request() req: any) {
    return this.service.retryDocument(id, req.user?.tenantId);
  }
}
