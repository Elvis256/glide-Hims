import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { QuotationService } from './quotation.service';
import { ContractService } from './contract.service';
import { OnboardingService } from './onboarding.service';
import {
  CreateCatalogItemDto,
  UpdateCatalogItemDto,
  CreateQuotationDto,
  UpdateQuotationDto,
  CreateRevisionDto,
  RejectQuotationDto,
} from './quotation.dtos';

function ensureTenant(req: any): string {
  const tid = req.user?.tenantId;
  if (!tid) throw new ForbiddenException('Tenant context required');
  return tid;
}

@ApiTags('SaaS Quotations')
@Controller('saas-revenue')
export class QuotationController {
  constructor(
    private readonly service: QuotationService,
    private readonly contractService: ContractService,
    private readonly onboardingService: OnboardingService,
  ) {}

  private assertAdmin(req: any) {
    if (!req.user?.isSystemAdmin) throw new ForbiddenException('System admin only');
  }

  // =========================================================================
  // Price Catalog
  // =========================================================================

  @Get('price-catalog')
  @ApiOperation({ summary: 'List price catalog items' })
  async listCatalog(@Req() req: any) {
    this.assertAdmin(req);
    return this.service.listCatalogItems();
  }

  @Post('price-catalog')
  @ApiOperation({ summary: 'Create a price catalog item' })
  async createCatalogItem(@Req() req: any, @Body() dto: CreateCatalogItemDto) {
    this.assertAdmin(req);
    return this.service.createCatalogItem(dto);
  }

  @Put('price-catalog/:id')
  @ApiOperation({ summary: 'Update a price catalog item' })
  async updateCatalogItem(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCatalogItemDto,
  ) {
    this.assertAdmin(req);
    return this.service.updateCatalogItem(id, dto);
  }

  @Delete('price-catalog/:id')
  @ApiOperation({ summary: 'Delete a price catalog item' })
  async deleteCatalogItem(@Req() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.service.deleteCatalogItem(id);
  }

  // =========================================================================
  // Quotations CRUD
  // =========================================================================

  @Get('quotations')
  @ApiOperation({ summary: 'List quotations' })
  async listQuotations(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('leadId') leadId?: string,
  ) {
    this.assertAdmin(req);
    return this.service.listQuotations({ status, leadId });
  }

  @Post('quotations')
  @ApiOperation({ summary: 'Create a quotation' })
  async createQuotation(@Req() req: any, @Body() dto: CreateQuotationDto) {
    this.assertAdmin(req);
    return this.service.createQuotation(dto, req.user?.id);
  }

  @Get('quotations/:id')
  @ApiOperation({ summary: 'Get a quotation with current revision' })
  async getQuotation(@Req() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.service.getQuotation(id);
  }

  @Put('quotations/:id')
  @ApiOperation({ summary: 'Update a quotation (draft only)' })
  async updateQuotation(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateQuotationDto) {
    this.assertAdmin(req);
    return this.service.updateQuotation(id, dto, req.user?.id);
  }

  @Delete('quotations/:id')
  @ApiOperation({ summary: 'Delete a quotation (draft only)' })
  async deleteQuotation(@Req() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.service.deleteQuotation(id);
  }

  @Post('quotations/from-lead/:leadId')
  @ApiOperation({ summary: 'Create quotation from a lead' })
  async createFromLead(@Req() req: any, @Param('leadId') leadId: string) {
    this.assertAdmin(req);
    return this.service.createQuotationFromLead(leadId, req.user?.id);
  }

  // =========================================================================
  // Revisions
  // =========================================================================

  @Post('quotations/:id/revisions')
  @ApiOperation({ summary: 'Create a new revision' })
  async createRevision(@Req() req: any, @Param('id') id: string, @Body() dto: CreateRevisionDto) {
    this.assertAdmin(req);
    return this.service.createRevision(id, dto, req.user?.id);
  }

  @Get('quotations/:id/revisions')
  @ApiOperation({ summary: 'List all revisions' })
  async listRevisions(@Req() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.service.listRevisions(id);
  }

  @Get('quotations/:id/revisions/:num')
  @ApiOperation({ summary: 'Get a specific revision' })
  async getRevision(@Req() req: any, @Param('id') id: string, @Param('num') num: string) {
    this.assertAdmin(req);
    return this.service.getRevision(id, parseInt(num, 10));
  }

  // =========================================================================
  // Status transitions
  // =========================================================================

  @Post('quotations/:id/send')
  @ApiOperation({ summary: 'Mark quotation as sent and email client' })
  async sendQuotation(@Req() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.service.sendQuotation(id);
  }

  @Post('quotations/:id/accept')
  @ApiOperation({ summary: 'Accept quotation (triggers auto-provision)' })
  async acceptQuotation(@Req() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.service.acceptQuotation(id);
  }

  @Post('quotations/:id/reject')
  @ApiOperation({ summary: 'Reject quotation' })
  async rejectQuotation(@Req() req: any, @Param('id') id: string, @Body() dto: RejectQuotationDto) {
    this.assertAdmin(req);
    return this.service.rejectQuotation(id, dto.reason);
  }

  // =========================================================================
  // HTML rendering
  // =========================================================================

  @Get('quotations/:id/html')
  @ApiOperation({ summary: 'Print-ready HTML quotation' })
  async getQuotationHtml(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    this.assertAdmin(req);
    const html = await this.service.renderQuotationHtml(id);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  // =========================================================================
  // Self-service portal (tenant-scoped /my/* endpoints)
  // =========================================================================

  @Get('my/quotations')
  @ApiOperation({ summary: 'Client: list quotations sent to me' })
  async myQuotations(@Req() req: any) {
    const tenantId = ensureTenant(req);
    // Return quotations linked to this tenant via subscription
    return this.service.listQuotationsForTenant(tenantId);
  }

  @Post('my/quotations/:id/accept')
  @ApiOperation({ summary: 'Client: self-accept a quotation' })
  async myAcceptQuotation(@Req() req: any, @Param('id') id: string) {
    ensureTenant(req);
    return this.service.acceptQuotation(id);
  }

  @Get('my/contract')
  @ApiOperation({ summary: 'Client: view active contract' })
  async myContract(@Req() req: any) {
    const tenantId = ensureTenant(req);
    const { items } = await this.contractService.listContracts({ status: 'active' });
    return items.find((c) => c.tenantId === tenantId) || null;
  }

  @Get('my/onboarding')
  @ApiOperation({ summary: 'Client: view onboarding progress' })
  async myOnboarding(@Req() req: any) {
    const tenantId = ensureTenant(req);
    const { items } = await this.onboardingService.listOnboardings({});
    return items.find((o) => o.tenantId === tenantId) || null;
  }
}
