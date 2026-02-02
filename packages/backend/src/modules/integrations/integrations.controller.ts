import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { OpenFDAService } from './openfda.service';
import { AfricasTalkingService } from './africas-talking.service';
import { LOINCService } from './loinc.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly openFDAService: OpenFDAService,
    private readonly africasTalkingService: AfricasTalkingService,
    private readonly loincService: LOINCService,
  ) {}

  // ========== Status Endpoints ==========

  @Get('status')
  @AuthWithPermissions('reports.read')
  @ApiOperation({ summary: 'Get status of all external integrations' })
  async getStatus() {
    const smsBalance = await this.africasTalkingService.getBalance();
    
    return {
      openFDA: {
        configured: true, // No API key required
        description: 'FDA drug database - labels, interactions, recalls',
      },
      africasTalking: {
        configured: this.africasTalkingService.isConfigured(),
        balance: smsBalance,
        description: 'SMS notifications for patients',
      },
      loinc: {
        configured: true, // No API key required
        description: 'Lab test codes and reference ranges',
      },
    };
  }

  // ========== openFDA Endpoints ==========

  @Get('drugs/search')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Search FDA drug database' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'limit', required: false })
  async searchDrugs(
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ) {
    if (!query || query.length < 2) {
      return { data: [], message: 'Query must be at least 2 characters' };
    }
    const results = await this.openFDAService.searchDrugs(query, limit || 10);
    return { data: results, count: results.length };
  }

  @Get('drugs/ndc/:ndc')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get drug by NDC code' })
  async getDrugByNDC(@Query('ndc') ndc: string) {
    const drug = await this.openFDAService.getDrugByNDC(ndc);
    return { data: drug };
  }

  @Post('drugs/interactions')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Check drug interactions between medications' })
  async checkDrugInteractions(@Body() dto: { drugs: string[] }) {
    if (!dto.drugs || dto.drugs.length < 2) {
      return { hasInteractions: false, interactions: [], message: 'Need at least 2 drugs to check' };
    }
    return this.openFDAService.checkDrugInteractions(dto.drugs);
  }

  @Get('drugs/adverse-events')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get adverse events (side effects) for a drug' })
  @ApiQuery({ name: 'drug', required: true })
  @ApiQuery({ name: 'limit', required: false })
  async getAdverseEvents(
    @Query('drug') drugName: string,
    @Query('limit') limit?: number,
  ) {
    const events = await this.openFDAService.getAdverseEvents(drugName, limit || 20);
    return { data: events, count: events.length };
  }

  @Get('drugs/side-effects')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get common side effects statistics for a drug' })
  @ApiQuery({ name: 'drug', required: true })
  async getSideEffects(@Query('drug') drugName: string) {
    const stats = await this.openFDAService.getSideEffectsStats(drugName);
    return { data: stats };
  }

  @Get('drugs/recalls')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get recent drug recalls' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getDrugRecalls(
    @Query('q') query?: string,
    @Query('limit') limit?: number,
  ) {
    const recalls = await this.openFDAService.getDrugRecalls(query, limit || 20);
    return { data: recalls, count: recalls.length };
  }

  // ========== SMS Endpoints ==========

  @Get('sms/status')
  @AuthWithPermissions('admin.read')
  @ApiOperation({ summary: 'Get SMS service status and balance' })
  async getSMSStatus() {
    const configured = this.africasTalkingService.isConfigured();
    const balance = configured ? await this.africasTalkingService.getBalance() : null;
    return { configured, balance };
  }

  @Post('sms/send')
  @AuthWithPermissions('notifications.create')
  @ApiOperation({ summary: 'Send SMS to a phone number' })
  async sendSMS(@Body() dto: { to: string; message: string; from?: string }) {
    const result = await this.africasTalkingService.sendSMS(dto.to, dto.message, dto.from);
    return result;
  }

  @Post('sms/send-bulk')
  @AuthWithPermissions('notifications.create')
  @ApiOperation({ summary: 'Send bulk SMS to multiple recipients' })
  async sendBulkSMS(@Body() dto: { recipients: string[]; message: string; from?: string }) {
    const result = await this.africasTalkingService.sendBulkSMS(dto.recipients, dto.message, dto.from);
    return result;
  }

  @Post('sms/appointment-reminder')
  @AuthWithPermissions('notifications.create')
  @ApiOperation({ summary: 'Send appointment reminder SMS' })
  async sendAppointmentReminder(@Body() dto: {
    phone: string;
    patientName: string;
    appointmentDate: string;
    appointmentTime: string;
    doctorName?: string;
    hospitalName?: string;
  }) {
    return this.africasTalkingService.sendAppointmentReminder(
      dto.phone,
      dto.patientName,
      dto.appointmentDate,
      dto.appointmentTime,
      dto.doctorName,
      dto.hospitalName,
    );
  }

  @Post('sms/lab-results')
  @AuthWithPermissions('notifications.create')
  @ApiOperation({ summary: 'Send lab results ready notification' })
  async sendLabResultsNotification(@Body() dto: {
    phone: string;
    patientName: string;
    hospitalName?: string;
  }) {
    return this.africasTalkingService.sendLabResultsNotification(
      dto.phone,
      dto.patientName,
      dto.hospitalName,
    );
  }

  @Post('sms/prescription-ready')
  @AuthWithPermissions('notifications.create')
  @ApiOperation({ summary: 'Send prescription ready notification' })
  async sendPrescriptionReady(@Body() dto: {
    phone: string;
    patientName: string;
    pharmacyLocation?: string;
  }) {
    return this.africasTalkingService.sendPrescriptionReady(
      dto.phone,
      dto.patientName,
      dto.pharmacyLocation,
    );
  }

  // ========== LOINC Lab Test Endpoints ==========

  @Get('loinc/search')
  @AuthWithPermissions('lab.read')
  @ApiOperation({ summary: 'Search LOINC lab test codes' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'limit', required: false })
  async searchLOINC(
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ) {
    if (!query || query.length < 2) {
      return { data: [], message: 'Query must be at least 2 characters' };
    }
    const results = await this.loincService.searchCodes(query, limit || 20);
    return { data: results, count: results.length };
  }

  @Get('loinc/common')
  @AuthWithPermissions('lab.read')
  @ApiOperation({ summary: 'Get common lab tests with reference ranges' })
  @ApiQuery({ name: 'category', required: false })
  async getCommonLabTests(@Query('category') category?: string) {
    const tests = this.loincService.getCommonLabTests(category);
    return { data: tests, count: tests.length };
  }

  @Get('loinc/categories')
  @AuthWithPermissions('lab.read')
  @ApiOperation({ summary: 'Get lab test categories' })
  async getLabCategories() {
    return { data: this.loincService.getCategories() };
  }

  @Get('loinc/reference/:code')
  @AuthWithPermissions('lab.read')
  @ApiOperation({ summary: 'Get reference range for a LOINC code' })
  async getReferenceRange(@Query('code') code: string) {
    const range = this.loincService.getReferenceRange(code);
    return { data: range };
  }

  @Post('loinc/check-value')
  @AuthWithPermissions('lab.read')
  @ApiOperation({ summary: 'Check if a lab value is within normal range' })
  async checkLabValue(@Body() dto: { loincCode: string; value: number }) {
    const result = this.loincService.checkValue(dto.loincCode, dto.value);
    return result;
  }
}
