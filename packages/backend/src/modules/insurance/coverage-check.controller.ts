import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CoverageCheckService } from './coverage-check.service';
import { CheckCoverageDto } from './dto/coverage-check.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@ApiTags('Insurance')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('billing')
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
