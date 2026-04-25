import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { SuppliersService } from './suppliers.service';
import { SupplierScoringService } from './supplier-scoring.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/suppliers.dto';
import { SupplierType, SupplierStatus } from '../../database/entities/supplier.entity';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@UseGuards(ModuleGuard)
@RequireModule('stores')
@Controller('suppliers')
export class SuppliersController {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly scoringService: SupplierScoringService,
  ) {}

  @Post()
  @AuthWithPermissions('suppliers.create')
  create(@Body() dto: CreateSupplierDto, @Request() req: any) {
    return this.suppliersService.create(dto, req.user?.tenantId);
  }

  @Get()
  @AuthWithPermissions('suppliers.read')
  async findAll(
    @Query('facilityId') facilityId: string,
    @Query('type') type?: SupplierType,
    @Query('status') status?: SupplierStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Request() req?: any,
  ) {
    const result = await this.suppliersService.findAll(
      facilityId,
      {
        type,
        status,
        search,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
      },
      req?.user?.tenantId,
    );
    const canViewFinancials = this.hasFinanceAccess(req?.user);
    return {
      ...result,
      data: result.data.map((s) => (canViewFinancials ? s : this.redactFinancials(s))),
    };
  }

  @Get('active')
  @AuthWithPermissions('suppliers.read')
  async getActiveSuppliers(@Query('facilityId') facilityId: string, @Request() req: any) {
    const suppliers = await this.suppliersService.getActiveSuppliers(
      facilityId,
      req.user?.tenantId,
    );
    const canViewFinancials = this.hasFinanceAccess(req?.user);
    return canViewFinancials ? suppliers : suppliers.map((s) => this.redactFinancials(s));
  }

  @Get('dashboard')
  @AuthWithPermissions('suppliers.read')
  getDashboard(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.suppliersService.getDashboard(facilityId, req.user?.tenantId);
  }

  @Get('rankings')
  @AuthWithPermissions('suppliers.read')
  getSupplierRankings(@Request() req: any) {
    return this.scoringService.getSupplierRankings(req.user?.tenantId);
  }

  @Get(':id/scorecard')
  @AuthWithPermissions('suppliers.read')
  getSupplierScorecard(
    @Param('id') id: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Request() req?: any,
  ) {
    return this.scoringService.getSupplierScorecard(id, req?.user?.tenantId, dateFrom, dateTo);
  }

  @Get(':id')
  @AuthWithPermissions('suppliers.read')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.suppliersService.findOne(id, req.user?.tenantId);
  }

  @Put(':id')
  @AuthWithPermissions('suppliers.update')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto, @Request() req: any) {
    return this.suppliersService.update(id, dto, req.user?.tenantId);
  }

  @Delete(':id')
  @AuthWithPermissions('suppliers.delete')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.suppliersService.remove(id, req.user?.tenantId);
  }

  private hasFinanceAccess(user: any): boolean {
    const roles: string[] = user?.roles || [];
    const permissions: string[] = user?.permissions || [];
    return (
      roles.some((r) =>
        ['Super Admin', 'System Administrator', 'Finance', 'Accountant'].includes(r),
      ) ||
      permissions.includes('suppliers.update') ||
      permissions.includes('finance.read')
    );
  }

  private redactFinancials(supplier: any): any {
    const { bankName, bankAccount, taxId, creditLimit, ...safe } = supplier;
    return safe;
  }
}
