import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { Res } from '@nestjs/common';
import { InsuranceService } from './insurance.service';
import { ClaimExportService } from './claim-export.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import {
  CreateProviderDto,
  UpdateProviderDto,
  CreatePolicyDto,
  CreateClaimDto,
  CreateClaimItemDto,
  CreatePreAuthDto,
  ProcessClaimDto,
  ProcessPreAuthDto,
  RecordPaymentDto,
  BatchSubmitClaimsDto,
} from './dto/insurance.dto';
import { ClaimStatus } from '../../database/entities/insurance-claim.entity';
import { PolicyStatus } from '../../database/entities/insurance-policy.entity';
import { PreAuthStatus } from '../../database/entities/pre-authorization.entity';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@ApiTags('Insurance')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('billing')
@Controller('insurance')
export class InsuranceController {
  constructor(
    private readonly insuranceService: InsuranceService,
    private readonly claimExportService: ClaimExportService,
  ) {}

  private static readonly MAX_RANGE_DAYS = 366;
  private assertDateRange(startDate?: string, endDate?: string, required = true) {
    if (!startDate || !endDate) {
      if (required) {
        throw new BadRequestException('startDate and endDate are required (YYYY-MM-DD)');
      }
      return;
    }
    const a = new Date(startDate);
    const b = new Date(endDate);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
      throw new BadRequestException('startDate/endDate must be ISO dates (YYYY-MM-DD)');
    }
    if (b < a) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
    const days = Math.floor((b.getTime() - a.getTime()) / 86_400_000);
    if (days > InsuranceController.MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Date range exceeds ${InsuranceController.MAX_RANGE_DAYS} days`,
      );
    }
  }

  // ============ DASHBOARD ============
  @Get('dashboard')
  @AuthWithPermissions('insurance.read')
  @ApiOperation({ summary: 'Get insurance dashboard' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getDashboard(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.insuranceService.getDashboard(facilityId, req.user?.tenantId);
  }

  // ============ PROVIDERS ============
  @Post('providers')
  @AuthWithPermissions('insurance.providers.create')
  @ApiOperation({ summary: 'Create insurance provider' })
  async createProvider(@Body() dto: CreateProviderDto, @Request() req: any) {
    return this.insuranceService.createProvider(dto, req.user?.tenantId);
  }

  @Get('providers')
  @AuthWithPermissions('insurance.providers.read')
  @ApiOperation({ summary: 'Get insurance providers' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'active', required: false })
  async getProviders(
    @Query('facilityId') facilityId: string,
    @Query('active') active?: boolean,
    @Request() req?: any,
  ) {
    return this.insuranceService.getProviders(facilityId, { active }, req?.user?.tenantId);
  }

  @Get('providers/:id')
  @AuthWithPermissions('insurance.providers.read')
  @ApiOperation({ summary: 'Get provider by ID' })
  async getProvider(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.insuranceService.getProvider(id, req.user?.tenantId);
  }

  @Patch('providers/:id')
  @AuthWithPermissions('insurance.providers.update')
  @ApiOperation({ summary: 'Update provider' })
  async updateProvider(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProviderDto,
    @Request() req: any,
  ) {
    return this.insuranceService.updateProvider(id, dto, req.user?.tenantId);
  }

  // ============ POLICIES ============
  @Post('policies')
  @AuthWithPermissions('insurance.policies.create')
  @ApiOperation({ summary: 'Create insurance policy' })
  async createPolicy(@Body() dto: CreatePolicyDto, @Request() req: any) {
    return this.insuranceService.createPolicy(dto, req.user?.tenantId);
  }

  @Get('policies')
  @AuthWithPermissions('insurance.policies.read')
  @ApiOperation({ summary: 'Get policies' })
  @ApiQuery({ name: 'providerId', required: false })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: PolicyStatus })
  async getPolicies(
    @Query('providerId') providerId?: string,
    @Query('patientId') patientId?: string,
    @Query('status') status?: PolicyStatus,
    @Request() req?: any,
  ) {
    return this.insuranceService.getPolicies(
      { providerId, patientId, status },
      req?.user?.tenantId,
    );
  }

  @Get('policies/:id')
  @AuthWithPermissions('insurance.policies.read')
  @ApiOperation({ summary: 'Get policy by ID' })
  async getPolicy(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.insuranceService.getPolicy(id, req.user?.tenantId);
  }

  @Get('patients/:patientId/policies')
  @AuthWithPermissions('insurance.policies.read')
  @ApiOperation({ summary: 'Get patient active policies' })
  async getPatientPolicies(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Request() req: any,
  ) {
    return this.insuranceService.getPatientActivePolicies(patientId, req.user?.tenantId);
  }

  @Post('policies/:id/verify')
  @AuthWithPermissions('insurance.policies.update')
  @ApiOperation({ summary: 'Verify policy' })
  async verifyPolicy(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.insuranceService.verifyPolicy(id, req.user?.tenantId);
  }

  @Patch('policies/:id/status')
  @AuthWithPermissions('insurance.policies.update')
  @ApiOperation({ summary: 'Update policy status' })
  async updatePolicyStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: PolicyStatus,
    @Request() req?: any,
  ) {
    if (!status || !Object.values(PolicyStatus).includes(status)) {
      throw new BadRequestException(
        `status must be one of: ${Object.values(PolicyStatus).join(', ')}`,
      );
    }
    return this.insuranceService.updatePolicyStatus(id, status, req?.user?.tenantId);
  }

  // ============ CLAIMS ============
  @Post('claims')
  @AuthWithPermissions('insurance.claims.create')
  @ApiOperation({ summary: 'Create claim' })
  async createClaim(@Body() dto: CreateClaimDto, @Request() req: any) {
    return this.insuranceService.createClaim(dto, req.user?.tenantId);
  }

  @Get('claims')
  @AuthWithPermissions('insurance.claims.read')
  @ApiOperation({ summary: 'Get claims' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'status', required: false, enum: ClaimStatus })
  @ApiQuery({ name: 'providerId', required: false })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getClaims(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: ClaimStatus,
    @Query('providerId') providerId?: string,
    @Query('patientId') patientId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: any,
  ) {
    this.assertDateRange(startDate, endDate, false);
    return this.insuranceService.getClaims(
      facilityId,
      { status, providerId, patientId, startDate, endDate },
      req?.user?.tenantId,
    );
  }

  @Get('claims/:id')
  @AuthWithPermissions('insurance.claims.read')
  @ApiOperation({ summary: 'Get claim by ID' })
  async getClaim(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.insuranceService.getClaim(id, req.user?.tenantId);
  }

  @Post('claims/:id/items')
  @AuthWithPermissions('insurance.claims.update')
  @ApiOperation({ summary: 'Add item to claim' })
  async addClaimItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClaimItemDto,
    @Request() req: any,
  ) {
    return this.insuranceService.addClaimItem(id, dto, req.user?.tenantId);
  }

  @Post('claims/:id/submit')
  @AuthWithPermissions('insurance.claims.update')
  @ApiOperation({ summary: 'Submit claim' })
  async submitClaim(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.insuranceService.submitClaim(id, req.user.id, req.user?.tenantId);
  }

  @Get('claims/:id/pdf')
  @AuthWithPermissions('insurance.claims.read')
  @ApiOperation({ summary: 'Download printable claim form (PDF)' })
  async claimPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const { filename, pdf } = await this.claimExportService.generateClaimPdf(
      id,
      req.user?.tenantId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length.toString());
    res.end(pdf);
  }

  @Get('claims/export.csv')
  @AuthWithPermissions('insurance.claims.read')
  @ApiOperation({ summary: 'Export submittable claims as a CSV batch (NHIS-style)' })
  @ApiQuery({ name: 'providerId', required: true })
  @ApiQuery({ name: 'dateFrom', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'dateTo', required: true, description: 'YYYY-MM-DD' })
  async exportBatchCsv(
    @Query('providerId') providerId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const { filename, csv, count } = await this.claimExportService.exportBatchCsv(
      providerId,
      dateFrom,
      dateTo,
      req.user?.tenantId,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Claim-Count', String(count));
    res.end(csv);
  }

  @Post('claims/:id/approve')
  @AuthWithPermissions('insurance.claims.process')
  @ApiOperation({ summary: 'Approve claim' })
  async approveClaim(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessClaimDto,
    @Request() req: any,
  ) {
    return this.insuranceService.processClaim(id, dto, true, req.user?.tenantId, req.user?.id);
  }

  @Post('claims/:id/reject')
  @AuthWithPermissions('insurance.claims.process')
  @ApiOperation({ summary: 'Reject claim' })
  async rejectClaim(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessClaimDto,
    @Request() req: any,
  ) {
    return this.insuranceService.processClaim(id, dto, false, req.user?.tenantId, req.user?.id);
  }

  @Post('claims/:id/payment')
  @AuthWithPermissions('insurance.claims.process')
  @ApiOperation({ summary: 'Record payment' })
  async recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
    @Request() req: any,
  ) {
    return this.insuranceService.recordPayment(id, dto, req.user?.tenantId, req.user?.id);
  }

  // ============ PRE-AUTHORIZATIONS ============
  @Post('pre-auth')
  @AuthWithPermissions('insurance.preauth.create')
  @ApiOperation({ summary: 'Create pre-authorization' })
  async createPreAuth(@Body() dto: CreatePreAuthDto, @Request() req: any) {
    return this.insuranceService.createPreAuth(dto, req.user.id, req.user?.tenantId);
  }

  @Get('pre-auth')
  @AuthWithPermissions('insurance.preauth.read')
  @ApiOperation({ summary: 'Get pre-authorizations' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'status', required: false, enum: PreAuthStatus })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'policyId', required: false })
  async getPreAuths(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: PreAuthStatus,
    @Query('patientId') patientId?: string,
    @Query('policyId') policyId?: string,
    @Request() req?: any,
  ) {
    return this.insuranceService.getPreAuths(
      facilityId,
      { status, patientId, policyId },
      req?.user?.tenantId,
    );
  }

  @Get('pre-auth/:id')
  @AuthWithPermissions('insurance.preauth.read')
  @ApiOperation({ summary: 'Get pre-authorization by ID' })
  async getPreAuth(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.insuranceService.getPreAuth(id, req.user?.tenantId);
  }

  @Post('pre-auth/:id/submit')
  @AuthWithPermissions('insurance.preauth.update')
  @ApiOperation({ summary: 'Submit pre-authorization' })
  async submitPreAuth(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.insuranceService.submitPreAuth(id, req.user?.tenantId);
  }

  @Post('pre-auth/:id/approve')
  @AuthWithPermissions('insurance.preauth.process')
  @ApiOperation({ summary: 'Approve pre-authorization' })
  async approvePreAuth(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessPreAuthDto,
    @Request() req: any,
  ) {
    return this.insuranceService.processPreAuth(id, dto, true, req.user?.tenantId, req.user?.id);
  }

  @Post('pre-auth/:id/deny')
  @AuthWithPermissions('insurance.preauth.process')
  @ApiOperation({ summary: 'Deny pre-authorization' })
  async denyPreAuth(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessPreAuthDto,
    @Request() req: any,
  ) {
    return this.insuranceService.processPreAuth(id, dto, false, req.user?.tenantId, req.user?.id);
  }

  // ============ REPORTS ============
  @Get('reports/denials-analysis')
  @AuthWithPermissions('insurance.reports.read')
  @ApiOperation({ summary: 'Get detailed denials analysis' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getDetailedDenialsAnalysis(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req?: any,
  ) {
    this.assertDateRange(startDate, endDate);
    return this.insuranceService.getDenialsAnalysis(
      facilityId,
      startDate,
      endDate,
      req?.user?.tenantId,
    );
  }

  @Get('reports/claim-status')
  @AuthWithPermissions('insurance.reports.read')
  @ApiOperation({ summary: 'Get claim status report' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getClaimStatusReport(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req?: any,
  ) {
    this.assertDateRange(startDate, endDate);
    return this.insuranceService.getClaimStatusReport(
      facilityId,
      startDate,
      endDate,
      req?.user?.tenantId,
    );
  }

  @Get('reports/denials')
  @AuthWithPermissions('insurance.reports.read')
  @ApiOperation({ summary: 'Get denials analysis' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getDenialsAnalysis(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req?: any,
  ) {
    this.assertDateRange(startDate, endDate);
    return this.insuranceService.getDenialsAnalysis(
      facilityId,
      startDate,
      endDate,
      req?.user?.tenantId,
    );
  }

  @Get('reports/provider-performance')
  @AuthWithPermissions('insurance.reports.read')
  @ApiOperation({ summary: 'Get provider performance' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getProviderPerformance(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req?: any,
  ) {
    this.assertDateRange(startDate, endDate);
    return this.insuranceService.getProviderPerformance(
      facilityId,
      startDate,
      endDate,
      req?.user?.tenantId,
    );
  }

  // ============ BATCH OPERATIONS ============
  @Post('batch-submit')
  @AuthWithPermissions('insurance.claims.create')
  @ApiOperation({ summary: 'Batch create and submit claims from encounters' })
  @ApiQuery({ name: 'facilityId', required: true })
  async batchSubmitClaims(
    @Body() body: BatchSubmitClaimsDto,
    @Query('facilityId') facilityId: string,
    @Request() req: any,
  ) {
    return this.insuranceService.batchSubmitClaims(
      body.encounterIds,
      facilityId,
      req.user?.tenantId,
      req.user?.id,
    );
  }

  // ============ ENCOUNTERS AWAITING CLAIMS ============
  @Get('encounters/awaiting-claims')
  @AuthWithPermissions('insurance.claims.read')
  @ApiOperation({ summary: 'Get insurance encounters awaiting claim creation' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'providerId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getEncountersAwaitingClaims(
    @Query('facilityId') facilityId: string,
    @Query('providerId') providerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: any,
  ) {
    this.assertDateRange(startDate, endDate, false);
    return this.insuranceService.getEncountersAwaitingClaims(
      facilityId,
      {
        providerId,
        startDate,
        endDate,
      },
      req?.user?.tenantId,
    );
  }

  @Post('encounters/:encounterId/create-claim')
  @AuthWithPermissions('insurance.claims.create')
  @ApiOperation({ summary: 'Create a claim from an encounter' })
  @ApiQuery({ name: 'facilityId', required: true })
  async createClaimFromEncounter(
    @Param('encounterId', ParseUUIDPipe) encounterId: string,
    @Query('facilityId') facilityId: string,
    @Request() req?: any,
  ) {
    return this.insuranceService.createClaimFromEncounter(
      encounterId,
      facilityId,
      req?.user?.tenantId,
    );
  }
}
