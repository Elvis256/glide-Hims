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
import { Auth } from '../auth/decorators/auth.decorator';
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
  @Auth()
  @ApiOperation({ summary: 'Get insurance dashboard' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getDashboard(@Query('facilityId') facilityId: string) {
    return this.insuranceService.getDashboard(facilityId);
  }

  // ============ PROVIDERS ============
  @Post('providers')
  @Auth('insurance.providers.create')
  @ApiOperation({ summary: 'Create insurance provider' })
  async createProvider(@Body() dto: CreateProviderDto) {
    return this.insuranceService.createProvider(dto);
  }

  @Get('providers')
  @Auth('insurance.providers.read')
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
  @Auth('insurance.providers.read')
  @ApiOperation({ summary: 'Get provider by ID' })
  async getProvider(@Param('id') id: string) {
    return this.insuranceService.getProvider(id);
  }

  @Patch('providers/:id')
  @Auth('insurance.providers.update')
  @ApiOperation({ summary: 'Update provider' })
  async updateProvider(@Param('id') id: string, @Body() dto: Partial<CreateProviderDto>) {
    return this.insuranceService.updateProvider(id, dto);
  }

  // ============ POLICIES ============
  @Post('policies')
  @Auth('insurance.policies.create')
  @ApiOperation({ summary: 'Create insurance policy' })
  async createPolicy(@Body() dto: CreatePolicyDto) {
    return this.insuranceService.createPolicy(dto);
  }

  @Get('policies')
  @Auth('insurance.policies.read')
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
  @Auth('insurance.policies.read')
  @ApiOperation({ summary: 'Get policy by ID' })
  async getPolicy(@Param('id') id: string) {
    return this.insuranceService.getPolicy(id);
  }

  @Get('patients/:patientId/policies')
  @Auth('insurance.policies.read')
  @ApiOperation({ summary: 'Get patient active policies' })
  async getPatientPolicies(@Param('patientId') patientId: string) {
    return this.insuranceService.getPatientActivePolicies(patientId);
  }

  @Post('policies/:id/verify')
  @Auth('insurance.policies.update')
  @ApiOperation({ summary: 'Verify policy' })
  async verifyPolicy(@Param('id') id: string) {
    return this.insuranceService.verifyPolicy(id);
  }

  @Patch('policies/:id/status')
  @Auth('insurance.policies.update')
  @ApiOperation({ summary: 'Update policy status' })
  async updatePolicyStatus(
    @Param('id') id: string,
    @Body('status') status: PolicyStatus,
  ) {
    return this.insuranceService.updatePolicyStatus(id, status);
  }

  // ============ CLAIMS ============
  @Post('claims')
  @Auth('insurance.claims.create')
  @ApiOperation({ summary: 'Create claim' })
  async createClaim(@Body() dto: CreateClaimDto) {
    return this.insuranceService.createClaim(dto);
  }

  @Get('claims')
  @Auth('insurance.claims.read')
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
  @Auth('insurance.claims.read')
  @ApiOperation({ summary: 'Get claim by ID' })
  async getClaim(@Param('id') id: string) {
    return this.insuranceService.getClaim(id);
  }

  @Post('claims/:id/items')
  @Auth('insurance.claims.update')
  @ApiOperation({ summary: 'Add item to claim' })
  async addClaimItem(@Param('id') id: string, @Body() dto: CreateClaimItemDto) {
    return this.insuranceService.addClaimItem(id, dto);
  }

  @Post('claims/:id/submit')
  @Auth('insurance.claims.update')
  @ApiOperation({ summary: 'Submit claim' })
  async submitClaim(@Param('id') id: string, @Request() req: any) {
    return this.insuranceService.submitClaim(id, req.user.id);
  }

  @Post('claims/:id/approve')
  @Auth('insurance.claims.process')
  @ApiOperation({ summary: 'Approve claim' })
  async approveClaim(@Param('id') id: string, @Body() dto: ProcessClaimDto) {
    return this.insuranceService.processClaim(id, dto, true);
  }

  @Post('claims/:id/reject')
  @Auth('insurance.claims.process')
  @ApiOperation({ summary: 'Reject claim' })
  async rejectClaim(@Param('id') id: string, @Body() dto: ProcessClaimDto) {
    return this.insuranceService.processClaim(id, dto, false);
  }

  @Post('claims/:id/payment')
  @Auth('insurance.claims.process')
  @ApiOperation({ summary: 'Record payment' })
  async recordPayment(@Param('id') id: string, @Body() dto: RecordPaymentDto) {
    return this.insuranceService.recordPayment(id, dto);
  }

  // ============ PRE-AUTHORIZATIONS ============
  @Post('pre-auth')
  @Auth('insurance.preauth.create')
  @ApiOperation({ summary: 'Create pre-authorization' })
  async createPreAuth(@Body() dto: CreatePreAuthDto, @Request() req: any) {
    return this.insuranceService.createPreAuth(dto, req.user.id);
  }

  @Get('pre-auth')
  @Auth('insurance.preauth.read')
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
  @Auth('insurance.preauth.read')
  @ApiOperation({ summary: 'Get pre-authorization by ID' })
  async getPreAuth(@Param('id') id: string) {
    return this.insuranceService.getPreAuth(id);
  }

  @Post('pre-auth/:id/submit')
  @Auth('insurance.preauth.update')
  @ApiOperation({ summary: 'Submit pre-authorization' })
  async submitPreAuth(@Param('id') id: string) {
    return this.insuranceService.submitPreAuth(id);
  }

  @Post('pre-auth/:id/approve')
  @Auth('insurance.preauth.process')
  @ApiOperation({ summary: 'Approve pre-authorization' })
  async approvePreAuth(@Param('id') id: string, @Body() dto: ProcessPreAuthDto) {
    return this.insuranceService.processPreAuth(id, dto, true);
  }

  @Post('pre-auth/:id/deny')
  @Auth('insurance.preauth.process')
  @ApiOperation({ summary: 'Deny pre-authorization' })
  async denyPreAuth(@Param('id') id: string, @Body() dto: ProcessPreAuthDto) {
    return this.insuranceService.processPreAuth(id, dto, false);
  }

  // ============ REPORTS ============
  @Get('reports/claim-status')
  @Auth('insurance.reports.read')
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
  @Auth('insurance.reports.read')
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
  @Auth('insurance.reports.read')
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
}
