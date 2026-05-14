import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { AuthWithModule } from '../auth/decorators/auth.decorator';
import {
  DashboardQueryDto,
  VisitsQueryDto,
  PatientStatsQueryDto,
  DiseaseStatsQueryDto,
  MortalityQueryDto,
  RevenueQueryDto,
  CollectionsQueryDto,
  OutstandingQueryDto,
  StockQueryDto,
  ConsumptionQueryDto,
  ExpiryQueryDto,
  HmisMonthlyDto,
  HmisWeeklyDto,
} from './reports.dto';
import * as XLSX from 'xlsx';

function rowsToCsv(rows: any[]): string {
  if (!rows || rows.length === 0) return '';
  const cols = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => escape(r[c])).join(','))].join('\n');
}

function rowsToXlsx(rows: any[], sheetName: string): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows || []);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
}

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('dashboard')
  @AuthWithModule('reports', 'reports.read')
  @ApiOperation({ summary: 'Composite KPI dashboard' })
  dashboard(@Query() q: DashboardQueryDto, @Req() req: any) {
    return this.svc.getDashboard(q, req.user?.tenantId);
  }

  @Get('visits')
  @AuthWithModule('reports', 'reports.read')
  visits(@Query() q: VisitsQueryDto, @Req() req: any) {
    return this.svc.getVisits(q, req.user?.tenantId);
  }

  @Get('patient-statistics')
  @AuthWithModule('reports', 'reports.read')
  patientStats(@Query() q: PatientStatsQueryDto, @Req() req: any) {
    return this.svc.getPatientStatistics(q, req.user?.tenantId);
  }

  @Get('disease-statistics')
  @AuthWithModule('reports', 'reports.read')
  diseaseStats(@Query() q: DiseaseStatsQueryDto, @Req() req: any) {
    return this.svc.getDiseaseStatistics(q, req.user?.tenantId);
  }

  @Get('mortality')
  @AuthWithModule('reports', 'reports.read')
  mortality(@Query() q: MortalityQueryDto, @Req() req: any) {
    return this.svc.getMortality(q, req.user?.tenantId);
  }

  @Get('revenue')
  @AuthWithModule('reports', 'reports.read', 'finance.read')
  revenue(@Query() q: RevenueQueryDto, @Req() req: any) {
    return this.svc.getRevenue(q, req.user?.tenantId);
  }

  @Get('collections')
  @AuthWithModule('reports', 'reports.read', 'finance.read')
  collections(@Query() q: CollectionsQueryDto, @Req() req: any) {
    return this.svc.getCollections(q, req.user?.tenantId);
  }

  @Get('outstanding')
  @AuthWithModule('reports', 'reports.read', 'billing.read')
  outstanding(@Query() q: OutstandingQueryDto, @Req() req: any) {
    return this.svc.getOutstanding(q, req.user?.tenantId);
  }

  @Get('stock')
  @AuthWithModule('reports', 'reports.read', 'pharmacy.read')
  stock(@Query() q: StockQueryDto, @Req() req: any) {
    return this.svc.getStock(q, req.user?.tenantId);
  }

  @Get('consumption')
  @AuthWithModule('reports', 'reports.read', 'pharmacy.read')
  consumption(@Query() q: ConsumptionQueryDto, @Req() req: any) {
    return this.svc.getConsumption(q, req.user?.tenantId);
  }

  @Get('expiry')
  @AuthWithModule('reports', 'reports.read', 'pharmacy.read')
  expiry(@Query() q: ExpiryQueryDto, @Req() req: any) {
    return this.svc.getExpiry(q, req.user?.tenantId);
  }

  // --- Statutory ----------------------------------------------------------

  @Get('statutory/hmis108')
  @AuthWithModule('reports', 'reports.statutory.read')
  async hmis108(@Query() q: HmisMonthlyDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const data = await this.svc.getHmis108(q, req.user?.tenantId);
    return this.respondStatutory(data, data.rows, `HMIS108_${q.period}`, q.format, res);
  }

  @Get('statutory/hmis122')
  @AuthWithModule('reports', 'reports.statutory.read')
  async hmis122(@Query() q: HmisMonthlyDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const data = await this.svc.getHmis122(q, req.user?.tenantId);
    return this.respondStatutory(data, data.rows, `HMIS122_${q.period}`, q.format, res);
  }

  @Get('statutory/eidsr')
  @AuthWithModule('reports', 'reports.statutory.read')
  async eidsr(@Query() q: HmisWeeklyDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const data = await this.svc.getEidsr(q, req.user?.tenantId);
    return this.respondStatutory(data, data.rows, `eIDSR_${q.week}`, q.format, res);
  }

  @Get('statutory/mtrac')
  @AuthWithModule('reports', 'reports.statutory.read')
  async mtrac(@Query() q: HmisWeeklyDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const data = await this.svc.getMtrac(q, req.user?.tenantId);
    return this.respondStatutory(data, data.rows, `mTrac_${q.week}`, q.format, res);
  }

  private respondStatutory(
    payload: any,
    rows: any[],
    filename: string,
    format: 'json' | 'csv' | 'xlsx' | undefined,
    res: Response,
  ) {
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return rowsToCsv(rows);
    }
    if (format === 'xlsx') {
      const buf = rowsToXlsx(rows, filename);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      return new StreamableFile(buf);
    }
    return payload;
  }
}
