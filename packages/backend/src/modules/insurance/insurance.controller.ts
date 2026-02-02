import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InsuranceService } from './insurance.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import {
  CreateProviderDto,
  CreatePolicyDto,
  CreateClaimDto,
  CreateClaimItemDto,
  CreatePreAuthDto,
  ProcessClaimDto,
  ProcessPreAuthDto,
  RecordPaymentDto,
} from './dto/insurance.dto';
import { ClaimStatus } from '../../database/entities/insurance-claim.entity';
import { PolicyStatus } from '../../database/entities/insurance-policy.entity';
import { PreAuthStatus } from '../../database/entities/pre-authorization.entity';

@ApiTags('Insurance')
@ApiBearerAuth()
@Controller('insurance')
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  // ============ DASHBOARD ============
  @Get('dashboard')
  @AuthWithPermissions('insurance.read')
  @ApiOperation({ summary: 'Get insurance dashboard' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getDashboard(@Query('facilityId') facilityId: string) {
    return this.insuranceService.getDashboard(facilityId);
  }

  // ============ PROVIDERS ============
  @Post('providers')
  @AuthWithPermissions('insurance.providers.create')
  @ApiOperation({ summary: 'Create insurance provider' })
  async createProvider(@Body() dto: CreateProviderDto) {
    return this.insuranceService.createProvider(dto);
  }

  @Get('providers')
  @AuthWithPermissions('insurance.providers.read')
  @ApiOperation({ summary: 'Get insurance providers' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'active', required: false })
  async getProviders(
    @Query('facilityId') facilityId: string,
    @Query('active') active?: boolean,
  ) {
    return this.insuranceService.getProviders(facilityId, { active });
  }

  @Get('providers/:id')
  @AuthWithPermissions('insurance.providers.read')
  @ApiOperation({ summary: 'Get provider by ID' })
  async getProvider(@Param('id') id: string) {
    return this.insuranceService.getProvider(id);
  }

  @Patch('providers/:id')
  @AuthWithPermissions('insurance.providers.update')
  @ApiOperation({ summary: 'Update provider' })
  async updateProvider(@Param('id') id: string, @Body() dto: Partial<CreateProviderDto>) {
    return this.insuranceService.updateProvider(id, dto);
  }

  // ============ POLICIES ============
  @Post('policies')
  @AuthWithPermissions('insurance.policies.create')
  @ApiOperation({ summary: 'Create insurance policy' })
  async createPolicy(@Body() dto: CreatePolicyDto) {
    return this.insuranceService.createPolicy(dto);
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
  ) {
    return this.insuranceService.getPolicies({ providerId, patientId, status });
  }

  @Get('policies/:id')
  @AuthWithPermissions('insurance.policies.read')
  @ApiOperation({ summary: 'Get policy by ID' })
  async getPolicy(@Param('id') id: string) {
    return this.insuranceService.getPolicy(id);
  }

  @Get('patients/:patientId/policies')
  @AuthWithPermissions('insurance.policies.read')
  @ApiOperation({ summary: 'Get patient active policies' })
  async getPatientPolicies(@Param('patientId') patientId: string) {
    return this.insuranceService.getPatientActivePolicies(patientId);
  }

  @Post('policies/:id/verify')
  @AuthWithPermissions('insurance.policies.update')
  @ApiOperation({ summary: 'Verify policy' })
  async verifyPolicy(@Param('id') id: string) {
    return this.insuranceService.verifyPolicy(id);
  }

  @Patch('policies/:id/status')
  @AuthWithPermissions('insurance.policies.update')
  @ApiOperation({ summary: 'Update policy status' })
  async updatePolicyStatus(
    @Param('id') id: string,
    @Body('status') status: PolicyStatus,
  ) {
    return this.insuranceService.updatePolicyStatus(id, status);
  }

  // ============ CLAIMS ============
  @Post('claims')
  @AuthWithPermissions('insurance.claims.create')
  @ApiOperation({ summary: 'Create claim' })
  async createClaim(@Body() dto: CreateClaimDto) {
    return this.insuranceService.createClaim(dto);
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
  ) {
    return this.insuranceService.getClaims(facilityId, { status, providerId, patientId, startDate, endDate });
  }

  @Get('claims/:id')
  @AuthWithPermissions('insurance.claims.read')
  @ApiOperation({ summary: 'Get claim by ID' })
  async getClaim(@Param('id') id: string) {
    return this.insuranceService.getClaim(id);
  }

  @Post('claims/:id/items')
  @AuthWithPermissions('insurance.claims.update')
  @ApiOperation({ summary: 'Add item to claim' })
  async addClaimItem(@Param('id') id: string, @Body() dto: CreateClaimItemDto) {
    return this.insuranceService.addClaimItem(id, dto);
  }

  @Post('claims/:id/submit')
  @AuthWithPermissions('insurance.claims.update')
  @ApiOperation({ summary: 'Submit claim' })
  async submitClaim(@Param('id') id: string, @Request() req: any) {
    return this.insuranceService.submitClaim(id, req.user.id);
  }

  @Post('claims/:id/approve')
  @AuthWithPermissions('insurance.claims.process')
  @ApiOperation({ summary: 'Approve claim' })
  async approveClaim(@Param('id') id: string, @Body() dto: ProcessClaimDto) {
    return this.insuranceService.processClaim(id, dto, true);
  }

  @Post('claims/:id/reject')
  @AuthWithPermissions('insurance.claims.process')
  @ApiOperation({ summary: 'Reject claim' })
  async rejectClaim(@Param('id') id: string, @Body() dto: ProcessClaimDto) {
    return this.insuranceService.processClaim(id, dto, false);
  }

  @Post('claims/:id/payment')
  @AuthWithPermissions('insurance.claims.process')
  @ApiOperation({ summary: 'Record payment' })
  async recordPayment(@Param('id') id: string, @Body() dto: RecordPaymentDto) {
    return this.insuranceService.recordPayment(id, dto);
  }

  // ============ PRE-AUTHORIZATIONS ============
  @Post('pre-auth')
  @AuthWithPermissions('insurance.preauth.create')
  @ApiOperation({ summary: 'Create pre-authorization' })
  async createPreAuth(@Body() dto: CreatePreAuthDto, @Request() req: any) {
    return this.insuranceService.createPreAuth(dto, req.user.id);
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
  ) {
    return this.insuranceService.getPreAuths(facilityId, { status, patientId, policyId });
  }

  @Get('pre-auth/:id')
  @AuthWithPermissions('insurance.preauth.read')
  @ApiOperation({ summary: 'Get pre-authorization by ID' })
  async getPreAuth(@Param('id') id: string) {
    return this.insuranceService.getPreAuth(id);
  }

  @Post('pre-auth/:id/submit')
  @AuthWithPermissions('insurance.preauth.update')
  @ApiOperation({ summary: 'Submit pre-authorization' })
  async submitPreAuth(@Param('id') id: string) {
    return this.insuranceService.submitPreAuth(id);
  }

  @Post('pre-auth/:id/approve')
  @AuthWithPermissions('insurance.preauth.process')
  @ApiOperation({ summary: 'Approve pre-authorization' })
  async approvePreAuth(@Param('id') id: string, @Body() dto: ProcessPreAuthDto) {
    return this.insuranceService.processPreAuth(id, dto, true);
  }

  @Post('pre-auth/:id/deny')
  @AuthWithPermissions('insurance.preauth.process')
  @ApiOperation({ summary: 'Deny pre-authorization' })
  async denyPreAuth(@Param('id') id: string, @Body() dto: ProcessPreAuthDto) {
    return this.insuranceService.processPreAuth(id, dto, false);
  }

  // ============ REPORTS ============
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
  ) {
    return this.insuranceService.getClaimStatusReport(facilityId, startDate, endDate);
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
  ) {
    return this.insuranceService.getDenialsAnalysis(facilityId, startDate, endDate);
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
  ) {
    return this.insuranceService.getProviderPerformance(facilityId, startDate, endDate);
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
  ) {
    return this.insuranceService.getEncountersAwaitingClaims(facilityId, {
      providerId,
      startDate,
      endDate,
    });
  }

  @Post('encounters/:encounterId/create-claim')
  @AuthWithPermissions('insurance.claims.create')
  @ApiOperation({ summary: 'Create a claim from an encounter' })
  @ApiQuery({ name: 'facilityId', required: true })
  async createClaimFromEncounter(
    @Param('encounterId') encounterId: string,
    @Query('facilityId') facilityId: string,
  ) {
    return this.insuranceService.createClaimFromEncounter(encounterId, facilityId);
  }
}
