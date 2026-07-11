import { Controller, Get, Post, Param, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ComplianceAutomationService } from './compliance-automation.service';

@ApiTags('Compliance Automation')
@RequireModule('finance')
@Controller('compliance')
export class ComplianceAutomationController {
  private readonly logger = new Logger(ComplianceAutomationController.name);

  constructor(private readonly complianceAutomationService: ComplianceAutomationService) {}

  @Post('collect')
  @AuthWithPermissions('admin.system')
  @ApiOperation({ summary: 'Trigger manual compliance evidence collection' })
  @ApiResponse({ status: 201, description: 'Evidence collection completed' })
  async collectEvidence() {
    this.logger.log('Manual compliance evidence collection triggered');
    return this.complianceAutomationService.runFullCollection();
  }

  @Get('evidence')
  @AuthWithPermissions('admin.system')
  @ApiOperation({ summary: 'List compliance evidence with optional filtering' })
  @ApiQuery({
    name: 'framework',
    required: false,
    description: 'Filter by framework (SOC2, ISO27001, HIPAA, INTERNAL)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (compliant, non_compliant, partial, not_assessed)',
  })
  @ApiQuery({ name: 'from', required: false, description: 'Filter from date (ISO string)' })
  @ApiQuery({ name: 'to', required: false, description: 'Filter to date (ISO string)' })
  @ApiResponse({ status: 200, description: 'List of compliance evidence' })
  async listEvidence(
    @Query('framework') framework?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.complianceAutomationService.listEvidence({
      framework,
      status,
      from,
      to,
    });
  }

  @Get('evidence/:id')
  @AuthWithPermissions('admin.system')
  @ApiOperation({ summary: 'Get a single compliance evidence record' })
  @ApiParam({ name: 'id', description: 'Evidence ID' })
  @ApiResponse({ status: 200, description: 'Compliance evidence detail' })
  @ApiResponse({ status: 404, description: 'Evidence not found' })
  async getEvidence(@Param('id') id: string) {
    return this.complianceAutomationService.findEvidenceById(id);
  }

  @Get('evidence/:id/verify')
  @AuthWithPermissions('admin.system')
  @ApiOperation({ summary: 'Verify integrity of a compliance evidence record' })
  @ApiParam({ name: 'id', description: 'Evidence ID' })
  @ApiResponse({ status: 200, description: 'Integrity verification result' })
  @ApiResponse({ status: 404, description: 'Evidence not found' })
  async verifyEvidence(@Param('id') id: string) {
    const isValid = await this.complianceAutomationService.verifyEvidenceIntegrity(id);
    return {
      evidenceId: id,
      integrityValid: isValid,
      verifiedAt: new Date(),
    };
  }

  @Get('report/:framework')
  @AuthWithPermissions('admin.system')
  @ApiOperation({ summary: 'Generate compliance report for a framework' })
  @ApiParam({
    name: 'framework',
    description: 'Compliance framework (SOC2, ISO27001, HIPAA, INTERNAL)',
  })
  @ApiResponse({ status: 200, description: 'Compliance report' })
  async getReport(@Param('framework') framework: string) {
    return this.complianceAutomationService.generateComplianceReport(framework);
  }

  @Get('score')
  @AuthWithPermissions('admin.system')
  @ApiOperation({ summary: 'Get compliance score summary across all frameworks' })
  @ApiResponse({ status: 200, description: 'Compliance score summary' })
  async getScore() {
    return this.complianceAutomationService.getComplianceScoreSummary();
  }
}
