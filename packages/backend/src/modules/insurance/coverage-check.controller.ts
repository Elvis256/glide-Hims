import { Controller, Post, Body, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CoverageCheckService } from './coverage-check.service';
import { CheckCoverageDto } from './dto/coverage-check.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@ApiTags('Insurance')
@ApiBearerAuth()
@Controller('insurance')
export class CoverageCheckController {
  constructor(private readonly coverageCheckService: CoverageCheckService) {}

  @Post('check-coverage')
  @AuthWithPermissions('insurance.policies.read')
  @ApiOperation({ summary: 'Check insurance coverage for prescribed drugs' })
  async checkCoverage(@Body() dto: CheckCoverageDto, @Request() req: any) {
    return this.coverageCheckService.checkCoverage(dto, req.user?.tenantId);
  }
}
