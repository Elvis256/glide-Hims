import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  Res,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { SkipTransform } from '../../common/interceptors/response-transform.interceptor';
import { ExportService } from './export.service';

const SUPPORTED_ENTITIES = ['users', 'audit-logs', 'patients', 'invoices', 'inventory'];

@ApiTags('export')
@RequireModule('reports')
@Controller('export')
export class ExportController {
  private readonly logger = new Logger(ExportController.name);

  constructor(private readonly exportService: ExportService) {}

  @Get('templates/user-import')
  @AuthWithPermissions('users.create')
  @SkipTransform()
  @ApiOperation({ summary: 'Download CSV template for bulk user import' })
  @ApiResponse({ status: 200, description: 'CSV template file' })
  async getUserImportTemplate(@Res() res: Response) {
    const csv = this.exportService.generateUserImportTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="user-import-template.csv"');
    res.send(csv);
  }

  @Get(':entity')
  @AuthWithPermissions('data.export')
  @SkipTransform()
  @ApiOperation({ summary: 'Export entity data as CSV or XLSX' })
  @ApiParam({ name: 'entity', description: 'Entity to export', enum: SUPPORTED_ENTITIES })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['csv', 'xlsx'],
    description: 'Export format (default: csv)',
  })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter end date (ISO 8601)' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term' })
  @ApiResponse({ status: 200, description: 'Exported file' })
  @ApiResponse({ status: 400, description: 'Invalid entity or format' })
  async exportEntity(
    @Param('entity') entity: string,
    @Query('format') format: string,
    @Request() req: any,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    if (!SUPPORTED_ENTITIES.includes(entity)) {
      throw new BadRequestException(
        `Unsupported entity "${entity}". Supported: ${SUPPORTED_ENTITIES.join(', ')}`,
      );
    }

    const normalizedFormat = (format || 'csv').toLowerCase();
    if (!['csv', 'xlsx'].includes(normalizedFormat)) {
      throw new BadRequestException('Format must be "csv" or "xlsx"');
    }

    const tenantId = req?.user?.tenantId;
    this.logger.log(`Exporting ${entity} as ${normalizedFormat} for tenant ${tenantId}`);

    const result = await this.exportService.exportEntity(entity, normalizedFormat, tenantId, {
      startDate,
      endDate,
      search,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  }
}
